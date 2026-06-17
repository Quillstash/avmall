/**
 * POST /api/v1/checkout
 *
 * Pay-on-delivery (POS/cash) checkout only.
 * Bank-transfer orders go through /api/v1/checkout/initiate instead,
 * where the order is created only after Nuqood confirms payment.
 *
 * Required headers:
 *   Idempotency-Key: <uuid>
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { computeQuote, resolveCartStoreId, type QuoteInputLine } from "@/lib/cart-quote";
import { reserveStock } from "@/lib/stock";
import { withIdempotency } from "@/lib/idempotency";
import { nextOrderNumber } from "@/lib/order-number";
import { writeAudit } from "@/lib/audit";
import { getCustomerSession } from "@/lib/customer-session";
import { normaliseNigerianPhone } from "@/lib/phone";
import { emailOnOrderCreated } from "@/lib/order-emails";
import { SITE } from "@/lib/site";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { setGrantCookie, GRANT_COOKIE } from "@/lib/track-grant";
import { AppError, BlacklistedError, NotFoundError, ValidationError } from "@/lib/errors";

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
  // Only POS/cash accepted here. Bank transfer uses /checkout/initiate.
  paymentMethod: z.enum(["pos", "cash"]),
  couponCode: z.string().optional(),
  /** Store the customer is ordering from. Falls back to the cookie, then Main. */
  storeId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get("idempotency-key") ?? undefined;
    const rawBody = await req.json();

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Checkout requires DATABASE_URL.",
        503,
      );
    }

    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({ [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid" });
    }
    const body = parsed.data;

    // Which store the order draws stock from — derived from the cart's
    // products (products are per-store), so attribution never depends on an
    // ambient cookie. Throws on an empty cart or one that mixes stores.
    const storeId = await resolveCartStoreId(db, body.items.map((i) => i.productId));

    const session = await getCustomerSession();
    const normalizedPhone = normaliseNigerianPhone(parsed.data.contact.phone);

    let customer = session
      ? await db.customer.findUnique({ where: { id: session.customerId } })
      : await db.customer.findFirst({ where: { storeId, phone: normalizedPhone } });

    if (!customer) {
      customer = await db.customer.create({
        data: {
          storeId,
          phone: normalizedPhone,
          email: parsed.data.contact.email ?? null,
          name: parsed.data.contact.name,
        },
      });
    } else if (parsed.data.contact.email && !customer.email) {
      customer = await db.customer.update({
        where: { id: customer.id },
        data: { email: parsed.data.contact.email },
      });
    }
    if (customer.blacklisted) throw new BlacklistedError();

    const result = await withIdempotency(idempotencyKey, body, async () => {
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

      let shippingKobo = 0;
      let freeShippingEligible = false;
      let shippingZoneId: string | null = null;
      const zone = await db.shippingZone.findFirst({
        where: { active: true, states: { has: body.shipping.state } },
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
        const fb = await db.fallbackShipping.findFirst();
        if (fb?.enabled) shippingKobo = Number(fb.flatRateKobo);
      }

      const quote = computeQuote({ lines: inputLines, ...(coupon && { coupon }), shippingKobo, freeShippingEligible });

      const order = await db.$transaction(async (tx) => {
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
            manualDiscountKobo: BigInt(0),
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

        await tx.stockReservation.updateMany({
          where: { orderId: null, status: "active" },
          data: { orderId: order.id },
        });

        if (coupon) {
          await tx.discount.update({ where: { code: coupon.code }, data: { usage: { increment: 1 }, locked: true } });
        }

        await writeAudit(
          {
            actorType: "customer",
            action: "order.create",
            entityType: "order",
            entityId: order.id,
            after: { number: order.number, totalKobo: Number(order.totalKobo), items: order.lines.length },
          },
          tx,
        );

        return order;
      }, { timeout: 20_000, maxWait: 10_000 });

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
          },
        },
        statusCode: 201,
      };
    });

    const res = NextResponse.json(apiSuccess(result.response), {
      status: result.statusCode,
      ...(result.replay && { headers: { "Idempotency-Replay": "true" } }),
    });
    setGrantCookie(res.cookies, result.response.order.number, req.cookies.get(GRANT_COOKIE)?.value);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
