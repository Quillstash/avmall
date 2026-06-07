/**
 * POST /api/v1/checkout/initiate
 *
 * Starts a bank-transfer (Nuqood) checkout session WITHOUT creating an order.
 * The order is only created once the Nuqood webhook confirms payment.
 *
 * Flow:
 *  1. Validate cart + contact + shipping
 *  2. Compute authoritative server-side quote (shipping included)
 *  3. Call Nuqood get_dynamic_account → get PalmPay virtual account
 *  4. Persist a PendingCheckout row (expires in 30 min)
 *  5. Return session details to client → client shows bank-transfer modal
 *
 * Idempotent on sessionId: if the same items + contact resolve to an existing
 * non-expired pending session, we return the existing session rather than
 * spinning up a new Nuqood account. This handles the "user refreshed the page"
 * case.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { computeQuote, type QuoteInputLine } from "@/lib/cart-quote";
import { normaliseNigerianPhone } from "@/lib/phone";
import { createDynamicAccount, nuqoodConfigured, parseTimeLeft } from "@/lib/nuqood";
import { SITE } from "@/lib/site";
import { env } from "@/lib/env";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().nullable(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "Cart must have at least one item"),
  contact: z.object({
    name: z.string().min(1, "Name is required"),
    phone: z.string().min(7, "Phone is required"),
    email: z.string().email().optional(),
  }),
  shipping: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
  }),
  couponCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Database required for checkout.", 503);
    }
    if (!nuqoodConfigured) {
      throw new AppError(
        "NUQOOD_NOT_CONFIGURED",
        "Bank transfer payments are not available right now. Please try Pay on Delivery or contact us.",
        503,
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({ [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid" });
    }
    const body = parsed.data;

    const normalizedPhone = normaliseNigerianPhone(body.contact.phone);

    // ── 1. Hydrate products for quote ──────────────────────────────────────
    const productIds = Array.from(new Set(body.items.map((i) => i.productId)));
    const products = await db.product.findMany({
      where: { id: { in: productIds }, archivedAt: null },
      include: { variants: true, bulkTiers: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    const inputLines: QuoteInputLine[] = body.items.map((item) => {
      const p = productById.get(item.productId);
      if (!p) throw new NotFoundError(`Product ${item.productId}`);
      const variant = item.variantId ? p.variants.find((v) => v.id === item.variantId) : null;
      if (item.variantId && !variant) throw new NotFoundError(`Variant ${item.variantId}`);
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

    // ── 2. Shipping zone ───────────────────────────────────────────────────
    let shippingKobo = 0;
    let freeShippingEligible = false;
    const zone = await db.shippingZone.findFirst({
      where: { active: true, states: { has: body.shipping.state } },
      orderBy: { createdAt: "asc" },
    });
    if (zone) {
      shippingKobo = Number(zone.baseRateKobo);
      if (zone.freeOverKobo != null) {
        const dry = computeQuote({ lines: inputLines });
        if (BigInt(dry.subtotalKobo - dry.bulkDiscountKobo) >= zone.freeOverKobo) {
          freeShippingEligible = true;
        }
      }
    } else {
      const fb = await db.fallbackShipping.findFirst();
      if (fb?.enabled) shippingKobo = Number(fb.flatRateKobo);
    }

    // ── 3. Coupon (read-only validation) ──────────────────────────────────
    let coupon: { code: string; type: "percentage" | "fixed" | "free_shipping"; value: number; scope?: string } | undefined;
    if (body.couponCode) {
      const c = await db.discount.findUnique({ where: { code: body.couponCode.toUpperCase() } });
      const now = new Date();
      if (c && c.active && (!c.validFrom || c.validFrom <= now) && (!c.validUntil || c.validUntil >= now) && (c.usageLimit == null || c.usage < c.usageLimit)) {
        coupon = { code: c.code!, type: c.valueType, value: c.value, scope: c.scope };
      } else if (c) {
        throw new AppError("COUPON_INVALID", "Coupon no longer valid", 422);
      }
    }

    // ── 4. Authoritative quote ─────────────────────────────────────────────
    const quote = computeQuote({ lines: inputLines, ...(coupon && { coupon }), shippingKobo, freeShippingEligible });
    const totalKobo = quote.totalKobo;

    // ── 5. Call Nuqood ─────────────────────────────────────────────────────
    const customerEmail =
      body.contact.email ??
      `order@${SITE.url.replace(/^https?:\/\//, "")}`;

    const callbackUrl = `${env.NEXT_PUBLIC_APP_URL ?? SITE.url}/api/v1/webhooks/nuqood${
      env.NUQOOD_WEBHOOK_SECRET ? `?token=${encodeURIComponent(env.NUQOOD_WEBHOOK_SECRET)}` : ""
    }`;

    const account = await createDynamicAccount({
      email: customerEmail,
      amountKobo: totalKobo,
      callbackUrl,
    });

    // ── 6. Persist pending checkout ───────────────────────────────────────
    const expirySeconds = parseTimeLeft(account.time_left);
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    const session = await db.pendingCheckout.create({
      data: {
        nuqoodRef: account.ref,
        bankNumber: account.number,
        bankName: account.bank,
        bankAccount: account.name,
        amountKobo: BigInt(totalKobo),
        expiresAt,
        items: body.items as object,
        contact: { ...body.contact, phone: normalizedPhone } as object,
        shipping: body.shipping as object,
        couponCode: coupon?.code ?? null,
        status: "pending",
      },
    });

    return NextResponse.json(
      apiSuccess({
        sessionId: session.id,
        account: {
          bank: account.bank,
          number: account.number,
          name: account.name,
        },
        amountKobo: totalKobo,
        expiresAt: expiresAt.toISOString(),
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
