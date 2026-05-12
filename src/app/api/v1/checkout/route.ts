/**
 * POST /api/v1/checkout
 *
 * The single most important state-mutating endpoint. Reserves stock inside a
 * transaction with SELECT FOR UPDATE so two simultaneous buyers can't both
 * win the last unit (CLAUDE.md §6 + §20).
 *
 * Required headers:
 *   Idempotency-Key: <uuid>        — replay-safe per §7
 *
 * Request body:
 *   {
 *     cartId: string,
 *     items: [{ productId, variantId, quantity }],   // server re-validates
 *     contact: { name, phone, email? },
 *     shipping: { line1, line2?, city, state },
 *     paymentMethod: "nuqood" | "transfer" | "pod",
 *     couponCode?: string,
 *   }
 *
 * Response (201):
 *   {
 *     order: { id, number, status, paymentStatus, totalKobo, ... },
 *     payment: { paymentUrl?: string }   // for nuqood, Phase 5 wires the real URL
 *   }
 *
 * Errors:
 *   400 VALIDATION
 *   401 UNAUTHORIZED         — customer not signed in
 *   403 BLACKLISTED          — customer is blocked
 *   404 NOT_FOUND            — referenced product/variant gone
 *   409 STOCK_UNAVAILABLE    — concurrent buyer won the race
 *   409 IDEMPOTENCY_CONFLICT — same key, different body
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { computeQuote, type QuoteInputLine } from "@/lib/cart-quote";
import { reserveStock } from "@/lib/stock";
import { withIdempotency } from "@/lib/idempotency";
import { nextOrderNumber } from "@/lib/order-number";
import { writeAudit } from "@/lib/audit";
import { getCustomerSession } from "@/lib/customer-session";
import { normaliseNigerianPhone } from "@/lib/phone";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import {
  AppError,
  BlacklistedError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

const bodySchema = z.object({
  cartId: z.string().min(1).optional(),
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
    name: z.string().min(1, "Recipient name is required"),
    phone: z.string().min(7, "Phone is required"),
    email: z.string().email().optional(),
  }),
  shipping: z.object({
    line1: z.string().min(1, "Street address is required"),
    line2: z.string().optional(),
    city: z.string().min(1, "LGA is required"),
    state: z.string().min(1, "State is required"),
  }),
  paymentMethod: z.enum(["nuqood", "bank_transfer", "pos", "cash"]),
  couponCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get("idempotency-key") ?? undefined;
    const rawBody = await req.json();

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Checkout requires DATABASE_URL — set up Neon (docs/phase4-setup.md).",
        503,
      );
    }

    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const body = parsed.data;

    // Auth — customer must be signed in to check out. (Mock mode handled above.)
    const session = await getCustomerSession();
    if (!session) {
      throw new AppError("UNAUTHORIZED", "Sign in before checking out", 401);
    }
    const customer = await db.customer.findUnique({
      where: { id: session.customerId },
    });
    if (!customer) throw new AppError("UNAUTHORIZED", "Account not found", 401);
    if (customer.blacklisted) throw new BlacklistedError();

    const result = await withIdempotency(idempotencyKey, body, async () => {
      const order = await db.$transaction(async (tx) => {
        // 1. Hydrate products + variants (current price, current bulk tiers)
        const productIds = Array.from(new Set(body.items.map((i) => i.productId)));
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, archivedAt: null },
          include: { variants: true, bulkTiers: true },
        });
        const productById = new Map(products.map((p) => [p.id, p]));

        const inputLines: QuoteInputLine[] = body.items.map((item) => {
          const p = productById.get(item.productId);
          if (!p) throw new NotFoundError(`Product ${item.productId}`);

          const variant = item.variantId
            ? p.variants.find((v) => v.id === item.variantId)
            : null;
          if (item.variantId && !variant) {
            throw new NotFoundError(`Variant ${item.variantId}`);
          }

          const unitKobo = Number(
            variant?.priceKobo ?? (p.saleActive && p.saleKobo != null ? p.saleKobo : p.priceKobo),
          );

          return {
            productId: p.id,
            variantId: variant?.id ?? null,
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

        // 2. Coupon validation
        let coupon:
          | { code: string; type: "percentage" | "fixed" | "free_shipping"; value: number }
          | undefined;
        if (body.couponCode) {
          const c = await tx.discount.findUnique({
            where: { code: body.couponCode.toUpperCase() },
          });
          const now = new Date();
          if (
            c &&
            c.active &&
            (!c.validFrom || c.validFrom <= now) &&
            (!c.validUntil || c.validUntil >= now) &&
            (c.usageLimit == null || c.usage < c.usageLimit)
          ) {
            coupon = { code: c.code!, type: c.valueType, value: c.value };
          } else if (c) {
            throw new AppError("COUPON_INVALID", "Coupon no longer valid", 422);
          }
        }

        // 3. Shipping zone + free-over check
        let shippingKobo = 0;
        let freeShippingEligible = false;
        let shippingZoneId: string | null = null;
        const zone = await tx.shippingZone.findFirst({
          where: { active: true, states: { has: body.shipping.state } },
          orderBy: { priority: "asc" },
        });
        if (zone) {
          shippingZoneId = zone.id;
          shippingKobo = Number(zone.baseRateKobo);
          if (zone.freeOverKobo != null) {
            const dry = computeQuote({ lines: inputLines });
            if (BigInt(dry.subtotalKobo - dry.bulkDiscountKobo) >= zone.freeOverKobo) {
              freeShippingEligible = true;
            }
          }
        } else {
          const fb = await tx.fallbackShipping.findFirst();
          if (fb?.enabled) shippingKobo = Number(fb.flatRateKobo);
        }

        // 4. Server-side quote (authoritative)
        const quote = computeQuote({
          lines: inputLines,
          ...(coupon && { coupon }),
          shippingKobo,
          freeShippingEligible,
        });

        // 5. Reserve stock — this is the SELECT FOR UPDATE block per §6
        await reserveStock(
          tx,
          inputLines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          null, // we don't have the order id yet — set below after order create
        );

        // 6. Create the order
        const orderNumber = await nextOrderNumber(tx);
        const normalizedPhone = normaliseNigerianPhone(body.contact.phone);

        const order = await tx.order.create({
          data: {
            number: orderNumber,
            customerId: customer.id,
            status: "pending",
            paymentStatus: "unpaid",
            source: "web",
            shipName: body.contact.name,
            shipPhone: normalizedPhone,
            shipLine1: body.shipping.line1,
            shipLine2: body.shipping.line2 ?? null,
            shipCity: body.shipping.city,
            shipState: body.shipping.state,
            shippingZoneId,
            subtotalKobo: BigInt(quote.subtotalKobo),
            bulkDiscountKobo: BigInt(quote.bulkDiscountKobo),
            couponDiscountKobo: BigInt(quote.couponDiscountKobo),
            manualDiscountKobo: BigInt(quote.manualDiscountKobo),
            shippingKobo: BigInt(quote.shippingKobo),
            totalKobo: BigInt(quote.totalKobo),
            paidKobo: BigInt(0),
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

        // 7. Attach the new orderId to the just-created reservations
        await tx.stockReservation.updateMany({
          where: { orderId: null, status: "active" },
          data: { orderId: order.id },
        });

        // 8. Bump coupon usage
        if (coupon) {
          await tx.discount.update({
            where: { code: coupon.code },
            data: { usage: { increment: 1 }, locked: true },
          });
        }

        // 9. Audit
        await writeAudit(
          {
            actorType: "customer",
            action: "order.create",
            entityType: "order",
            entityId: order.id,
            after: {
              number: order.number,
              totalKobo: Number(order.totalKobo),
              items: order.lines.length,
            },
          },
          tx,
        );

        return order;
      });

      return {
        response: {
          order: {
            id: order.id,
            number: order.number,
            status: order.status,
            paymentStatus: order.paymentStatus,
            totalKobo: Number(order.totalKobo),
            paidKobo: Number(order.paidKobo),
          },
          // Phase 5 — Nuqood will return a real payment URL. For now a stub.
          payment:
            body.paymentMethod === "nuqood"
              ? { paymentUrl: `/orders/${order.number}` }
              : { paymentUrl: null },
        },
        statusCode: 201,
      };
    });

    return NextResponse.json(apiSuccess(result.response), {
      status: result.statusCode,
      ...(result.replay && { headers: { "Idempotency-Replay": "true" } }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
