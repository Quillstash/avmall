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
 *     acceptable: boolean,
 *     counterOfferKobo?: number,   // only when !acceptable
 *     floorKobo: number,           // INTERNAL — do not surface to customer
 *     baselineKobo: number,        // current retail/sale price the offer is against
 *     savingsKobo?: number,        // how much the customer saved (when acceptable)
 *     messageHint: string,         // phrasing the AI should adapt
 *     reason: string,              // why this verdict — internal only
 *   }
 *
 * Auth: Bearer AI_AGENT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireAiAgent } from "@/lib/ai-auth";
import { applyPercentageDiscount } from "@/lib/money";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  productSlug: z.string().min(1),
  offerKobo: z.number().int().positive(),
  quantity: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    requireAiAgent(req);

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

    if (!product.negotiate) {
      throw new ConflictError("This product is not open to negotiation");
    }

    // Master kill-switch from AiSettings (defaults to enabled).
    const ai = await db.aiSettings.findUnique({ where: { key: "default" } });
    const negotiationEnabled = ai?.negotiationEnabled ?? true;
    if (!negotiationEnabled) {
      throw new ConflictError("Negotiation is globally disabled — escalate to staff");
    }

    const baselineKobo = Number(
      product.saleActive && product.saleKobo != null ? product.saleKobo : product.priceKobo,
    );

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
      // Customer is offering ≥ retail. Accept happily — no counter needed.
      return NextResponse.json(
        apiSuccess({
          acceptable: true,
          floorKobo,
          baselineKobo,
          savingsKobo: 0,
          messageHint:
            "Customer offered at or above retail — confirm the order at the offered price.",
          reason: `offer ≥ baseline (₦${offerKobo / 100} ≥ ₦${baselineKobo / 100})`,
        }),
      );
    }

    if (offerKobo >= floorKobo) {
      const savings = baselineKobo - offerKobo;
      return NextResponse.json(
        apiSuccess({
          acceptable: true,
          floorKobo,
          baselineKobo,
          savingsKobo: savings,
          messageHint: `Accept the offer. Tell the customer we can do ₦${(offerKobo / 100).toLocaleString("en-NG")} — that's a saving of ₦${(savings / 100).toLocaleString("en-NG")} off the regular price. Do not mention the floor.`,
          reason: `offer ≥ floor (basis: ${floorBasis})`,
        }),
      );
    }

    // Below the floor — counter at exactly the floor, framed warmly.
    return NextResponse.json(
      apiSuccess({
        acceptable: false,
        counterOfferKobo: floorKobo,
        floorKobo,
        baselineKobo,
        messageHint: `Counter with ₦${(floorKobo / 100).toLocaleString("en-NG")}. Frame it as the best you can do today. Never reveal that the offer was below a floor. If the customer pushes again, offer to escalate to a human (handoff).`,
        reason: `offer < floor (basis: ${floorBasis})`,
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
