/**
 * POST /api/v1/cart/:id/quote
 *
 * Returns the authoritative cart totals. The client NEVER computes the total
 * itself — it always calls this endpoint before showing the user a number.
 * See CLAUDE.md §12.
 *
 * Request body:
 *   {
 *     items: [{ productId, variantId, quantity }],
 *     couponCode?: string,
 *     state?: string,        // for shipping zone match
 *   }
 *
 * Response:
 *   { quote: Quote }
 *
 * Errors:
 *   404 PRODUCT_UNAVAILABLE  — referenced product or variant is missing/archived
 *   422 COUPON_INVALID       — coupon expired or hit usage limit
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { computeQuote, type QuoteInputLine } from "@/lib/cart-quote";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { NotFoundError, ValidationError, AppError } from "@/lib/errors";

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
  couponCode: z.string().optional(),
  state: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError({
        body: parsed.error.issues[0]?.message ?? "Invalid body",
      });
    }

    // Mock-mode short-circuit (Phase 4 design grace).
    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Cart quote requires DATABASE_URL — running in mock mode. Use the client cart store.",
        503,
      );
    }

    const { items, couponCode, state } = parsed.data;

    // Hydrate every line from the DB. We trust nothing the client sent about
    // prices.
    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const products = await db.product.findMany({
      where: { id: { in: productIds }, archivedAt: null },
      include: { variants: true, bulkTiers: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    const inputLines: QuoteInputLine[] = items.map((item) => {
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

    // Coupon lookup
    let coupon: { code: string; type: "percentage" | "fixed" | "free_shipping"; value: number } | undefined;
    if (couponCode) {
      const c = await db.discount.findUnique({ where: { code: couponCode.toUpperCase() } });
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
        throw new AppError("COUPON_INVALID", "Coupon expired or has hit its usage limit", 422);
      }
    }

    // Shipping zone — first active match for the state, ordered by priority.
    let shippingKobo = 0;
    let freeShippingEligible = false;
    if (state) {
      const zone = await db.shippingZone.findFirst({
        where: { active: true, states: { has: state } },
        orderBy: { priority: "asc" },
      });
      if (zone) {
        shippingKobo = Number(zone.baseRateKobo);
        // We do a first-pass quote without shipping to know the after-bulk
        // subtotal that determines free-shipping eligibility.
        if (zone.freeOverKobo != null) {
          const dry = computeQuote({ lines: inputLines });
          const afterBulk = dry.subtotalKobo - dry.bulkDiscountKobo;
          if (BigInt(afterBulk) >= zone.freeOverKobo) {
            freeShippingEligible = true;
          }
        }
      } else {
        const fb = await db.fallbackShipping.findFirst();
        if (fb?.enabled) shippingKobo = Number(fb.flatRateKobo);
      }
    }

    const quote = computeQuote({
      lines: inputLines,
      ...(coupon && { coupon }),
      shippingKobo,
      freeShippingEligible,
    });

    // Stamp the cart with the latest quote id so checkout can verify it
    // hasn't drifted (Phase 5 enhancement; for now just include it on the
    // response).
    const quoteId = crypto.randomUUID();
    await db.cart
      .update({
        where: { id: params.id },
        data: { lastQuoteId: quoteId, updatedAt: new Date() },
      })
      .catch(() => undefined);

    return NextResponse.json(apiSuccess({ quote, quoteId }));
  } catch (err) {
    return handleApiError(err);
  }
}
