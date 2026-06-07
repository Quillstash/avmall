/**
 * POST /api/v1/ai/tools/orders
 *
 * Create an order on behalf of a customer the AI is chatting with. Mirrors
 * the customer `/checkout` flow but the AI is the actor — `source: "ai"` is
 * stamped on the row.
 *
 * Per CLAUDE.md §6 stock is reserved inside a SELECT FOR UPDATE transaction
 * so two simultaneous buyers can't both win the last unit.
 *
 * Body:
 *   {
 *     items: [{ productSlug, quantity, variantId? }],
 *     contact: { name, phone, email? },
 *     shipping: { line1, line2?, city, state },
 *     couponCode?: string,
 *     /// AI may pass an Idempotency-Key header to dedupe retries.
 *   }
 *
 * Response (201): { order: { id, number, status, paymentStatus, totalKobo, paidKobo } }
 *
 * Auth: Bearer AI_AGENT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireAiAgent } from "@/lib/ai-auth";
import { computeQuote, type QuoteInputLine } from "@/lib/cart-quote";
import { reserveStock } from "@/lib/stock";
import { getMainStoreId } from "@/lib/store";
import { withIdempotency } from "@/lib/idempotency";
import { nextOrderNumber } from "@/lib/order-number";
import { writeAudit } from "@/lib/audit";
import { normaliseNigerianPhone } from "@/lib/phone";
import { emailOnOrderCreated } from "@/lib/order-emails";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import {
  AppError,
  BlacklistedError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productSlug: z.string().min(1),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "Order must have at least one item"),
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
  couponCode: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    requireAiAgent(req);

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Order creation requires DATABASE_URL.",
        503,
      );
    }

    const rawBody = await req.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const body = parsed.data;
    const idempotencyKey = req.headers.get("idempotency-key") ?? body.idempotencyKey;

    const normalizedPhone = normaliseNigerianPhone(body.contact.phone);

    // Find-or-create the customer by phone.
    let customer = await db.customer.findUnique({ where: { phone: normalizedPhone } });
    if (!customer) {
      customer = await db.customer.create({
        data: {
          phone: normalizedPhone,
          email: body.contact.email ?? null,
          name: body.contact.name,
        },
      });
    }
    if (customer.blacklisted) throw new BlacklistedError();

    const result = await withIdempotency(idempotencyKey, body, async () => {
      // Hydrate products
      const slugs = Array.from(new Set(body.items.map((i) => i.productSlug)));
      // AI orders draw from the Main store (the storefront default).
      const storeId = await getMainStoreId();
      if (!storeId) throw new AppError("NO_STORE", "No store available.", 503);

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
        const variant = item.variantId
          ? p.variants.find((v) => v.id === item.variantId)
          : (p.variants.find((v) => {
              const s = v.storeStock[0];
              return s && s.onHand - s.reserved > 0;
            }) ?? p.variants[0]);
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

      // Coupon
      let coupon:
        | { code: string; type: "percentage" | "fixed" | "free_shipping"; value: number }
        | undefined;
      if (body.couponCode) {
        const c = await db.discount.findUnique({
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

      // Shipping
      let shippingKobo = 0;
      let shippingZoneId: string | null = null;
      let freeShippingEligible = false;
      const zone = await db.shippingZone.findFirst({
        where: { active: true, states: { has: body.shipping.state } },
        orderBy: { createdAt: "asc" },
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
        const fb = await db.fallbackShipping.findFirst();
        if (fb?.enabled) shippingKobo = Number(fb.flatRateKobo);
      }

      const quote = computeQuote({
        lines: inputLines,
        ...(coupon && { coupon }),
        shippingKobo,
        freeShippingEligible,
      });

      const order = await db.$transaction(
        async (tx) => {
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
              customerId: customer.id,
              storeId,
              status: "pending",
              paymentStatus: "unpaid",
              source: "ai",
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
                  const p = products.find((x) => x.id === l.productId)!;
                  const v = l.variantId
                    ? p.variants.find((x) => x.id === l.variantId)
                    : null;
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

          if (coupon) {
            await tx.discount.update({
              where: { code: coupon.code },
              data: { usage: { increment: 1 }, locked: true },
            });
          }

          await writeAudit(
            {
              actorType: "ai",
              action: "order.create",
              entityType: "order",
              entityId: created.id,
              after: {
                number: created.number,
                totalKobo: Number(created.totalKobo),
                items: created.lines.length,
                source: "ai",
              },
            },
            tx,
          );

          return created;
        },
        { timeout: 20_000, maxWait: 10_000 },
      );

      void emailOnOrderCreated(order.id);

      return {
        response: {
          order: {
            id: order.id,
            number: order.number,
            status: order.status,
            paymentStatus: order.paymentStatus,
            totalKobo: Number(order.totalKobo),
            paidKobo: Number(order.paidKobo),
            outstandingKobo: Number(order.totalKobo) - Number(order.paidKobo),
          },
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
