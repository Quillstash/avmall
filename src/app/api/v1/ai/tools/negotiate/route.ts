/**
 * POST /api/v1/ai/tools/negotiate
 *
 * The negotiation tool from CLAUDE.md §21. Given a product slug and the
 * customer's offer (in kobo), decides whether the AI is allowed to settle
 * at that price, what counter-offer to make, and what the AI should say.
 *
 * Floor resolution order:
 *   1. Per-product `negotiateFloorKobo`  (explicit money floor)
 *   2. Per-product `negotiateMaxPct`     (% off retail)
 *   3. AiSettings global `globalNegotiateMaxPct` (% off retail, site-wide)
 *
 * The `floorKobo` value is INTERNAL — it must never appear in the AI's
 * reply to the customer. Use `messageHint` to phrase the response.
 *
 * Body:
 *   {
 *     productSlug: string,
 *     offerKobo: number,         // what the customer is willing to pay (per unit)
 *     quantity?: number,         // default 1; only affects retail base when sale priced
 *   }
 *
 * Response:
 *   {
 *     negotiable: boolean,         // false = fixed-price / negotiation off — AI must NOT invent a discount
 *     acceptable: boolean,
 *     settlePriceKobo?: number,    // price to ACTUALLY charge when acceptable — never above baseline
 *     counterOfferKobo?: number,   // only when negotiable && !acceptable
 *     floorKobo?: number,          // INTERNAL, only when negotiable — do not surface to customer
 *     baselineKobo: number,        // current retail/sale price the offer is against
 *     savingsKobo?: number,        // how much the customer saved (when acceptable)
 *     messageHint: string,         // phrasing the AI should adapt — never invent prices/products
 *     reason: string,              // why this verdict — internal only
 *   }
 *
 * Negotiation only ever moves the price DOWN. The settle price is clamped to
 * [floor, baseline] — an offer at or above retail is confirmed at retail, never
 * at the (possibly inflated or garbled) offered amount.
 *
 * Auth: public — read-only catalogue tool, no token required.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { applyPercentageDiscount, formatMoney } from "@/lib/money";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  productSlug: z.string().min(1),
  offerKobo: z.number().int().positive(),
  quantity: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Public tool: no auth required — read-only catalogue/quote data.

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Negotiation requires DATABASE_URL.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const { productSlug, offerKobo } = parsed.data;

    const product = await db.product.findUnique({
      where: { slug: productSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        priceKobo: true,
        saleKobo: true,
        saleActive: true,
        negotiate: true,
        negotiateFloorKobo: true,
        negotiateMaxPct: true,
      },
    });
    if (!product) throw new NotFoundError(`Product ${productSlug}`);

    const baselineKobo = Number(
      product.saleActive && product.saleKobo != null ? product.saleKobo : product.priceKobo,
    );

    // Not open to negotiation → return a STRUCTURED refusal (HTTP 200), not an
    // error. A tool that returns an error status invites the LLM to improvise an
    // answer — that's how the fake "iPhone 16 accepted" happened. A clear
    // negotiable:false result with a strict script keeps the agent grounded.
    if (!product.negotiate) {
      return NextResponse.json(
        apiSuccess({
          negotiable: false,
          acceptable: false,
          baselineKobo,
          messageHint: `This item is sold at a fixed price of ${formatMoney(baselineKobo)} and cannot be discounted. Politely tell the customer the price is fixed. Do NOT invent a discount, a lower price, or a different product.`,
          reason: "product.negotiate = false",
        }),
      );
    }

    // Master kill-switch from AiSettings (defaults to enabled).
    const ai = await db.aiSettings.findUnique({ where: { key: "default" } });
    const negotiationEnabled = ai?.negotiationEnabled ?? true;
    if (!negotiationEnabled) {
      return NextResponse.json(
        apiSuccess({
          negotiable: false,
          acceptable: false,
          baselineKobo,
          messageHint: `Price negotiation is currently turned off. Tell the customer the price is ${formatMoney(baselineKobo)} and offer to connect them with a staff member. Do NOT invent a discount or price.`,
          reason: "AiSettings.negotiationEnabled = false",
        }),
      );
    }

    // Resolve the floor: explicit per-product, then per-product %, then AiSettings %.
    let floorKobo: number;
    let floorBasis: string;
    if (product.negotiateFloorKobo != null) {
      floorKobo = Number(product.negotiateFloorKobo);
      floorBasis = "per-product flat floor";
    } else if (product.negotiateMaxPct != null) {
      floorKobo = baselineKobo - applyPercentageDiscount(baselineKobo, product.negotiateMaxPct);
      floorBasis = `per-product ${product.negotiateMaxPct}% cap`;
    } else {
      const globalPct = ai?.globalNegotiateMaxPct ?? 10;
      floorKobo = baselineKobo - applyPercentageDiscount(baselineKobo, globalPct);
      floorBasis = `global ${globalPct}% cap`;
    }

    if (offerKobo >= baselineKobo) {
      // At or above retail. We NEVER charge above the list price — clamp the
      // settle price to baseline and confirm at our normal price. This guards
      // against an inflated or unit-garbled offer being billed as-is
      // (e.g. a ₦7,000,000 "offer" on an ₦85,000 phone).
      return NextResponse.json(
        apiSuccess({
          negotiable: true,
          acceptable: true,
          settlePriceKobo: baselineKobo,
          floorKobo,
          baselineKobo,
          savingsKobo: 0,
          messageHint: `The customer offered at or above our price. Do NOT charge more than retail — confirm the order at our normal price of ${formatMoney(baselineKobo)}.`,
          reason: `offer ≥ baseline — clamped to baseline (offer ${formatMoney(offerKobo)}, baseline ${formatMoney(baselineKobo)})`,
        }),
      );
    }

    if (offerKobo >= floorKobo) {
      const savings = baselineKobo - offerKobo;
      return NextResponse.json(
        apiSuccess({
          negotiable: true,
          acceptable: true,
          settlePriceKobo: offerKobo,
          floorKobo,
          baselineKobo,
          savingsKobo: savings,
          messageHint: `Accept the offer. Tell the customer we can do ${formatMoney(offerKobo)} — that's a saving of ${formatMoney(savings)} off the regular price. Do not mention the floor.`,
          reason: `offer ≥ floor (basis: ${floorBasis})`,
        }),
      );
    }

    // Below the floor — counter at exactly the floor, framed warmly.
    return NextResponse.json(
      apiSuccess({
        negotiable: true,
        acceptable: false,
        counterOfferKobo: floorKobo,
        floorKobo,
        baselineKobo,
        messageHint: `Counter with ${formatMoney(floorKobo)}. Frame it as the best you can do today. Never reveal that the offer was below a floor. If the customer pushes again, offer to escalate to a human (handoff).`,
        reason: `offer < floor (basis: ${floorBasis})`,
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
