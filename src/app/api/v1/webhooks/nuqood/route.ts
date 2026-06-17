/**
 * POST /api/v1/webhooks/nuqood?token=<shared secret>
 *
 * Nuqood pings here when a bank transfer is confirmed on a dynamic account.
 *
 * This is the moment the ORDER is created. Nothing exists in the orders
 * table until payment lands — the pre-payment state lives in PendingCheckout.
 *
 * Match strategy (two chances, most reliable first):
 *  1. transaction_reference === PendingCheckout.nuqoodRef
 *  2. account_number         === PendingCheckout.bankNumber  (fallback)
 *
 * Idempotency: if the session is already "paid", we return 200 immediately.
 *
 * Security: URL-token check (NUQOOD_WEBHOOK_SECRET). Requests without the
 * correct token are rejected 403. We also verify the incoming amount matches
 * the expected amount within ₦1 (rounding tolerance).
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { computeQuote, type QuoteInputLine } from "@/lib/cart-quote";
import { reserveStock } from "@/lib/stock";
import { getMainStoreId } from "@/lib/store";
import { writeAudit } from "@/lib/audit";
import { nextOrderNumber } from "@/lib/order-number";
import { normaliseNigerianPhone } from "@/lib/phone";
import { emailOnOrderCreated } from "@/lib/order-emails";
import { amountFromNuqood, type NuqoodWebhookPayload } from "@/lib/nuqood";
import { env } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(req: NextRequest) {
  // ── 1. URL-token auth ─────────────────────────────────────────────────
  const presented = req.nextUrl.searchParams.get("token") ?? "";
  const expected = env.NUQOOD_WEBHOOK_SECRET;
  if (!expected) {
    console.error("[nuqood-webhook] NUQOOD_WEBHOOK_SECRET not set — rejecting");
    return NextResponse.json({ error: { code: "WEBHOOK_NOT_CONFIGURED" } }, { status: 503 });
  }
  if (!safeEqual(presented, expected)) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  if (!hasDatabase) {
    return NextResponse.json({ error: { code: "DB_NOT_CONFIGURED" } }, { status: 503 });
  }

  // ── 2. Parse payload ──────────────────────────────────────────────────
  let payload: NuqoodWebhookPayload;
  try {
    payload = (await req.json()) as NuqoodWebhookPayload;
  } catch {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON" } }, { status: 400 });
  }
  if (!payload?.transaction_reference) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "transaction_reference missing" } },
      { status: 400 },
    );
  }

  const reference = payload.transaction_reference;
  const paidKobo = amountFromNuqood(payload.amount);

  // ── 3. Find pending session ───────────────────────────────────────────
  // Try by nuqood_ref first (most reliable), then fall back to account_number.
  let session = await db.pendingCheckout.findUnique({
    where: { nuqoodRef: reference },
  });
  if (!session && payload.account_number) {
    session = await db.pendingCheckout.findFirst({
      where: { bankNumber: payload.account_number, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!session) {
    // Unknown reference — accept 200 so Nuqood stops retrying, write audit.
    await writeAudit({
      actorType: "system",
      action: "payment.webhook_unknown_reference",
      entityType: "order_payment",
      entityId: reference,
      metadata: { channel: "nuqood-webhook", reference, paidKobo },
    });
    return NextResponse.json({ data: { received: true, kind: "unknown" } });
  }

  // Idempotency: already processed
  if (session.status === "paid") {
    return NextResponse.json({ data: { received: true, kind: "duplicate", orderNumber: session.orderNumber } });
  }

  // Session expired — refuse to create order for timed-out sessions.
  if (session.expiresAt <= new Date()) {
    await db.pendingCheckout.update({ where: { id: session.id }, data: { status: "expired" } });
    console.warn(`[nuqood-webhook] session ${session.id} expired — rejecting late webhook`);
    return NextResponse.json({ data: { received: true, kind: "expired" } });
  }

  // ── 4. Amount sanity check (within ₦1 = 100 kobo tolerance) ──────────
  const expectedKobo = Number(session.amountKobo);
  if (Math.abs(paidKobo - expectedKobo) > 100) {
    console.error(
      `[nuqood-webhook] amount mismatch: expected ${expectedKobo} kobo, got ${paidKobo} kobo (session ${session.id})`,
    );
    // Still accept the webhook but flag it for manual review.
    await writeAudit({
      actorType: "system",
      action: "payment.webhook_amount_mismatch",
      entityType: "order_payment",
      entityId: session.id,
      metadata: { expectedKobo, paidKobo, reference, channel: "nuqood-webhook" },
    });
  }

  // ── 5. Build the order inside a transaction ───────────────────────────
  type CartItem = { productId: string; variantId: string | null; quantity: number };
  type ContactData = { name: string; phone: string; email?: string };
  type ShippingData = { line1: string; line2?: string; city: string; state: string };

  const items = session.items as CartItem[];
  const contact = session.contact as ContactData;
  const shipping = session.shipping as ShippingData;

  try {
    const order = await db.$transaction(async (tx) => {
      // Re-hydrate products (price authoritative from DB)
      const productIds = Array.from(new Set(items.map((i) => i.productId)));
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, archivedAt: null },
        include: { variants: true, bulkTiers: true },
      });
      const productById = new Map(products.map((p) => [p.id, p]));

      const inputLines: QuoteInputLine[] = items.map((item) => {
        const p = productById.get(item.productId);
        if (!p) throw new NotFoundError(`Product ${item.productId}`);
        const variant = item.variantId ? p.variants.find((v) => v.id === item.variantId) : null;
        const unitKobo = Number(
          variant?.priceKobo ?? (p.saleActive && p.saleKobo != null ? p.saleKobo : p.priceKobo),
        );
        return {
          productId: p.id,
          variantId: variant?.id ?? null,
          quantity: item.quantity,
          unitKobo,
          bulkTiers: p.bulkTiers.map((t) => ({ min: t.min, max: t.max, type: t.type, value: t.value })),
        };
      });

      // Shipping zone
      let shippingKobo = 0;
      let freeShippingEligible = false;
      let shippingZoneId: string | null = null;
      const zone = await tx.shippingZone.findFirst({
        where: { active: true, states: { has: shipping.state } },
        orderBy: { createdAt: "asc" },
      });
      if (zone) {
        shippingZoneId = zone.id;
        shippingKobo = Number(zone.baseRateKobo);
        if (zone.freeOverKobo != null) {
          const dry = computeQuote({ lines: inputLines });
          if (BigInt(dry.subtotalKobo - dry.bulkDiscountKobo) >= zone.freeOverKobo) freeShippingEligible = true;
        }
      } else {
        const fb = await tx.fallbackShipping.findFirst();
        if (fb?.enabled) shippingKobo = Number(fb.flatRateKobo);
      }

      // Coupon
      let coupon: { code: string; type: "percentage" | "fixed" | "free_shipping"; value: number; scope?: string } | undefined;
      if (session.couponCode) {
        const c = await tx.discount.findUnique({ where: { code: session.couponCode } });
        if (c && c.active) coupon = { code: c.code!, type: c.valueType, value: c.value, scope: c.scope };
      }

      const quote = computeQuote({ lines: inputLines, ...(coupon && { coupon }), shippingKobo, freeShippingEligible });

      // Fulfil on the store the checkout was started for (derived from the
      // cart's products at initiate). Legacy sessions without a store fall
      // back to Main. Customers are per-store, so this must be resolved before
      // the find-or-create below.
      const storeId = session.storeId ?? (await getMainStoreId());
      if (!storeId) throw new Error("No store available to fulfil order");

      // Find or create customer (within the store)
      const normalizedPhone = normaliseNigerianPhone(contact.phone);
      let customer = await tx.customer.findFirst({
        where: { storeId, phone: normalizedPhone },
      });
      if (!customer) {
        customer = await tx.customer.create({
          data: { storeId, phone: normalizedPhone, email: contact.email ?? null, name: contact.name },
        });
      } else if (contact.email && !customer.email) {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: { email: contact.email },
        });
      }

      if (customer.blacklisted) {
        throw new Error(`Customer ${customer.id} is blacklisted`);
      }

      // Reserve stock.
      await reserveStock(
        tx,
        storeId,
        inputLines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
        null,
      );

      const orderNumber = await nextOrderNumber(tx);
      const order = await tx.order.create({
        data: {
          number: orderNumber,
          customerId: customer.id,
          storeId,
          status: "confirmed", // paid = auto-confirmed
          paymentStatus: "paid",
          source: "web",
          shipName: contact.name,
          shipPhone: normalizedPhone,
          shipLine1: shipping.line1,
          shipLine2: shipping.line2 ?? null,
          shipCity: shipping.city,
          shipState: shipping.state,
          shippingZoneId,
          subtotalKobo: BigInt(quote.subtotalKobo),
          bulkDiscountKobo: BigInt(quote.bulkDiscountKobo),
          couponDiscountKobo: BigInt(quote.couponDiscountKobo),
          manualDiscountKobo: BigInt(0),
          shippingKobo: BigInt(quote.shippingKobo),
          totalKobo: BigInt(quote.totalKobo),
          paidKobo: BigInt(paidKobo > 0 ? paidKobo : quote.totalKobo),
          appliedCouponCode: coupon?.code ?? null,
          lines: {
            create: quote.lines.map((l) => {
              const p = productById.get(l.productId)!;
              const v = l.variantId ? p.variants.find((x) => x.id === l.variantId) : null;
              return {
                productId: l.productId,
                variantId: l.variantId,
                nameSnapshot: p.name,
                variantSnapshot: v?.label ?? null,
                skuSnapshot: v?.sku ?? p.slug.toUpperCase(),
                quantity: l.quantity,
                unitKobo: BigInt(l.unitKobo),
                bulkDiscountKobo: BigInt(l.bulkDiscountKobo),
                bulkTierLabel: l.bulkTierLabel,
                preorder: p.preorder,
              };
            }),
          },
        },
        include: { lines: true },
      });

      // Link stock reservations to this order
      await tx.stockReservation.updateMany({
        where: { orderId: null, status: "active" },
        data: { orderId: order.id },
      });

      // Record the payment
      await tx.orderPayment.create({
        data: {
          orderId: order.id,
          method: "bank_transfer",
          amountKobo: BigInt(paidKobo > 0 ? paidKobo : quote.totalKobo),
          reference,
          status: "completed",
          note: JSON.stringify({
            bankAccount: { number: session.bankNumber, name: session.bankAccount, bank: session.bankName },
            senderName: payload.customer_sendername,
            senderBank: payload.customer_senderbankname,
          }),
        },
      });

      // Bump coupon usage
      if (coupon) {
        await tx.discount.update({
          where: { code: coupon.code },
          data: { usage: { increment: 1 }, locked: true },
        });
      }

      // Mark pending session as paid
      await tx.pendingCheckout.update({
        where: { id: session.id },
        data: { status: "paid", orderId: order.id, orderNumber },
      });

      await writeAudit(
        {
          actorType: "system",
          action: "order.create",
          entityType: "order",
          entityId: order.id,
          after: { number: orderNumber, totalKobo: Number(order.totalKobo), source: "nuqood-webhook" },
          metadata: { channel: "nuqood-webhook", reference, paidKobo },
        },
        tx,
      );

      return order;
    }, { timeout: 20_000, maxWait: 10_000 });

    void emailOnOrderCreated(order.id);

    return NextResponse.json({ data: { received: true, kind: "applied", orderNumber: order.number } });
  } catch (err) {
    console.error("[nuqood-webhook] failed:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Failed to process — Nuqood will retry" } },
      { status: 500 },
    );
  }
}
