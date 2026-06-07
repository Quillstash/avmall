/**
 * POST /api/v1/ai/tools/cart/quote
 *
 * Server-authoritative price quote for a hypothetical cart. The AI must call
 * this BEFORE quoting a total to the customer — the agent never computes
 * prices client-side (bulk tiers + sale + shipping rules are too subtle).
 *
 * Body:
 *   {
 *     items: [{ productSlug, quantity, variantId? }],
 *     state?: string,          // Nigerian state for shipping calc
 *     couponCode?: string,
 *   }
 *
 * Response:
 *   {
 *     subtotalKobo, bulkDiscountKobo, couponDiscountKobo,
 *     shippingKobo, totalKobo,
 *     freeShipping: boolean,
 *     itemCount: number,
 *     lines: [{ productSlug, name, quantity, unitKobo, lineTotalKobo, bulkTierLabel? }],
 *     shippingZone?: { name, etaDays },
 *   }
 *
 * Auth: Bearer AI_AGENT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireAiAgent } from "@/lib/ai-auth";
import { computeQuote, type QuoteInputLine } from "@/lib/cart-quote";
import { getMainStoreId } from "@/lib/store";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";

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
    .min(1),
  state: z.string().min(1).optional(),
  couponCode: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    requireAiAgent(req);

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Cart quote requires DATABASE_URL — the AI tool API can't run in mock mode.",
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

    // Hydrate products by slug — the AI passes slugs (not internal UUIDs).
    const storeId = await getMainStoreId();
    const slugs = Array.from(new Set(body.items.map((i) => i.productSlug)));
    const products = await db.product.findMany({
      where: { slug: { in: slugs }, archivedAt: null, published: true },
      include: {
        variants: {
          orderBy: { position: "asc" },
          include: { storeStock: storeId ? { where: { storeId } } : true },
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

    // Shipping zone (read-only)
    let shippingKobo = 0;
    let shippingZoneInfo: { name: string; etaDays: string } | null = null;
    let freeShippingEligible = false;
    if (body.state) {
      const zone = await db.shippingZone.findFirst({
        where: { active: true, states: { has: body.state } },
        orderBy: { createdAt: "asc" },
      });
      if (zone) {
        shippingZoneInfo = { name: zone.name, etaDays: zone.etaDays };
        shippingKobo = Number(zone.baseRateKobo);
        if (zone.freeOverKobo != null) {
          const dry = computeQuote({ lines: inputLines });
          if (BigInt(dry.subtotalKobo - dry.bulkDiscountKobo) >= zone.freeOverKobo) {
            freeShippingEligible = true;
          }
        }
      } else {
        const fb = await db.fallbackShipping.findFirst();
        if (fb?.enabled) {
          shippingKobo = Number(fb.flatRateKobo);
          shippingZoneInfo = { name: "Fallback", etaDays: fb.etaDays };
        }
      }
    }

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
      }
    }

    const quote = computeQuote({
      lines: inputLines,
      ...(coupon && { coupon }),
      shippingKobo,
      freeShippingEligible,
    });

    return NextResponse.json(
      apiSuccess({
        currency: "NGN",
        subtotalKobo: quote.subtotalKobo,
        bulkDiscountKobo: quote.bulkDiscountKobo,
        couponDiscountKobo: quote.couponDiscountKobo,
        shippingKobo: quote.shippingKobo,
        totalKobo: quote.totalKobo,
        displayTotal: formatMoney(quote.totalKobo),
        freeShipping: freeShippingEligible,
        itemCount: quote.itemCount,
        ...(coupon && {
          couponApplied: { code: coupon.code, type: coupon.type, value: coupon.value },
        }),
        ...(body.couponCode && !coupon && { couponRejected: body.couponCode.toUpperCase() }),
        lines: quote.lines.map((l) => {
          const p = products.find((x) => x.id === l.productId)!;
          return {
            productSlug: p.slug,
            name: p.name,
            quantity: l.quantity,
            unitKobo: l.unitKobo,
            lineTotalKobo: l.totalKobo,
            ...(l.bulkTierLabel && { bulkTierLabel: l.bulkTierLabel }),
          };
        }),
        ...(shippingZoneInfo && { shippingZone: shippingZoneInfo }),
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
