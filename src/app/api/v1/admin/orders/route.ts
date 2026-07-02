/**
 * POST /api/v1/admin/orders
 *
 * Staff-created manual order — walk-in, phone, or staff-assisted. Mirrors the
 * customer `/checkout` flow (find-or-create customer by phone, reserve stock
 * inside a SELECT FOR UPDATE transaction, write audit) but skips the OTP /
 * payment-link steps. The order is created in `pending` / `unpaid` state; the
 * existing `/orders/[number]/payments` endpoint records payments after.
 *
 * Body:
 *   {
 *     items: [{ productSlug, quantity }],   // first available variant is used
 *     contact: { name, phone, email? },
 *     shipping: { line1, line2?, city, state },
 *     manualDiscountKobo?: number,
 *     source?: "walkin"|"phone"|"whatsapp"|"instagram"|"facebook"|"web"|"manual",
 *     customerNote?: string,
 *   }
 *
 * Response (201):
 *   { order: { id, number, status, paymentStatus, totalKobo } }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { computeQuote, type QuoteInputLine } from "@/lib/cart-quote";
import { reserveStock } from "@/lib/stock";
import { nextOrderNumber } from "@/lib/order-number";
import { writeAudit } from "@/lib/audit";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { resolveAdminStoreId } from "@/lib/store";
import { normaliseNigerianPhone } from "@/lib/phone";
import { emailOnOrderCreated } from "@/lib/order-emails";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productSlug: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "Order must have at least one item"),
  contact: z.object({
    name: z.string().min(1, "Recipient name is required"),
    // Walk-ins often don't share a number. When present we still normalise +
    // find-or-create the customer so repeat buyers dedupe correctly.
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),
  shipping: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
  }),
  manualDiscountKobo: z.number().int().nonnegative().default(0),
  source: z
    .enum(["walkin", "phone", "whatsapp", "instagram", "facebook", "web", "manual"])
    .default("walkin"),
  customerNote: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "orders.create");

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Manual order requires DATABASE_URL.",
        503,
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const body = parsed.data;

    // Phone is optional for walk-ins. When given, normalise and dedupe by
    // phone like /checkout does. When absent, the order has no linked customer
    // (customerId stays null on the Order row).
    // Staff-created orders are scoped to the admin's active store.
    const storeId = await resolveAdminStoreId(session);
    if (!storeId) {
      throw new AppError("NO_STORE", "No store assigned to this staff member.", 400);
    }

    const rawPhone = body.contact.phone?.trim();
    const normalizedPhone = rawPhone ? normaliseNigerianPhone(rawPhone) : null;

    let customer: { id: string } | null = null;
    if (normalizedPhone) {
      const existing = await db.customer.findFirst({
        where: { storeId, phone: normalizedPhone },
      });
      customer = existing
        ? { id: existing.id }
        : await db.customer.create({
            data: {
              storeId,
              phone: normalizedPhone,
              email: body.contact.email ?? null,
              name: body.contact.name,
            },
            select: { id: true },
          });
    }

    // Defaults so staff don't have to retype "Walk-in" on every order.
    const shipLine1 = body.shipping.line1?.trim() || "Walk-in (in-store)";
    const shipCity = body.shipping.city?.trim() || "Lagos";
    const shipState = body.shipping.state?.trim() || "Lagos";
    const shipPhone = normalizedPhone ?? "Walk-in";

    // Hydrate products by slug. Mock-data slugs match DB slugs, so the form's
    // mock-driven product picker can submit slugs without resolving UUIDs.
    const slugs = Array.from(new Set(body.items.map((i) => i.productSlug)));
    const products = await db.product.findMany({
      where: { slug: { in: slugs }, archivedAt: null, published: true },
      include: {
        variants: {
          orderBy: { position: "asc" },
          include: { storeStock: { where: { storeId } } },
        },
        bulkTiers: true,
      },
    });
    const productBySlug = new Map(products.map((p) => [p.slug, p]));

    const inputLines: QuoteInputLine[] = body.items.map((item) => {
      const p = productBySlug.get(item.productSlug);
      if (!p) throw new NotFoundError(`Product ${item.productSlug}`);

      // Default to a variant in stock at this store, else the first variant.
      const variant =
        p.variants.find((v) => {
          const s = v.storeStock[0];
          return s && s.onHand - s.reserved > 0;
        }) ?? p.variants[0];
      if (!variant) throw new NotFoundError(`Variant for ${item.productSlug}`);

      const unitKobo = Number(
        variant.priceKobo ??
          (p.saleActive && p.saleKobo != null ? p.saleKobo : p.priceKobo),
      );

      return {
        productId: p.id,
        variantId: variant.id,
        quantity: item.quantity,
        unitKobo,
        bulkTiers: p.bulkTiers.map((t) => ({
          min: t.min,
          max: t.max,
          type: t.type,
          value: t.value,
        })),
      };
    });

    // Shipping zone (read-only). Manual orders use the same zone rules as web.
    let shippingKobo = 0;
    let shippingZoneId: string | null = null;
    const zone = await db.shippingZone.findFirst({
      where: { active: true, states: { has: shipState } },
      orderBy: { createdAt: "asc" },
    });
    if (zone) {
      shippingZoneId = zone.id;
      shippingKobo = Number(zone.baseRateKobo);
    } else {
      const fb = await db.fallbackShipping.findFirst();
      if (fb?.enabled) shippingKobo = Number(fb.flatRateKobo);
    }

    const quote = computeQuote({
      lines: inputLines,
      manualDiscountKobo: body.manualDiscountKobo,
      shippingKobo,
    });

    const order = await db.$transaction(
      async (tx) => {
        // Reserve stock at the operator's store (SELECT FOR UPDATE per §6).
        await reserveStock(
          tx,
          storeId,
          inputLines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          null,
        );

        const orderNumber = await nextOrderNumber(tx);

        const created = await tx.order.create({
          data: {
            number: orderNumber,
            customerId: customer?.id ?? null,
            storeId,
            status: "pending",
            paymentStatus: "unpaid",
            source: body.source,
            shipName: body.contact.name,
            shipPhone,
            shipLine1,
            shipLine2: body.shipping.line2 ?? null,
            shipCity,
            shipState,
            shippingZoneId,
            subtotalKobo: BigInt(quote.subtotalKobo),
            bulkDiscountKobo: BigInt(quote.bulkDiscountKobo),
            couponDiscountKobo: BigInt(0),
            manualDiscountKobo: BigInt(quote.manualDiscountKobo),
            shippingKobo: BigInt(quote.shippingKobo),
            totalKobo: BigInt(quote.totalKobo),
            paidKobo: BigInt(0),
            createdById: session.id,
            customerNote: body.customerNote ?? null,
            lines: {
              create: quote.lines.map((l) => {
                const p = products.find((x) => x.id === l.productId)!;
                const v = p.variants.find((x) => x.id === l.variantId);
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

        await tx.stockReservation.updateMany({
          where: { orderId: null, status: "active" },
          data: { orderId: created.id },
        });

        await writeAudit(
          {
            actorUserId: session.id,
            actorType: "staff",
            action: "order.create.manual",
            entityType: "order",
            entityId: created.id,
            after: {
              number: created.number,
              totalKobo: Number(created.totalKobo),
              items: created.lines.length,
              source: created.source,
            },
          },
          tx,
        );

        return created;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );

    void emailOnOrderCreated(order.id);

    return NextResponse.json(
      apiSuccess({
        order: {
          id: order.id,
          number: order.number,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalKobo: Number(order.totalKobo),
        },
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
