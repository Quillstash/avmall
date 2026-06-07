/**
 * GET /api/v1/ai/tools/shipping/quote?state=<state>&subtotalKobo=<n>
 *
 * Shipping rate + ETA for a Nigerian state. Optional subtotalKobo lets the
 * AI check whether the customer qualifies for free shipping. Falls back to
 * the flat rate when no zone covers the state.
 *
 * Auth: Bearer AI_AGENT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { requireAiAgent } from "@/lib/ai-auth";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    requireAiAgent(req);

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Shipping quote requires DATABASE_URL.", 503);
    }

    const state = req.nextUrl.searchParams.get("state")?.trim();
    if (!state) {
      throw new ValidationError({ state: "state query parameter is required" });
    }
    const subtotalParam = Number(req.nextUrl.searchParams.get("subtotalKobo"));
    const subtotalKobo =
      Number.isFinite(subtotalParam) && subtotalParam >= 0 ? subtotalParam : 0;

    const zone = await db.shippingZone.findFirst({
      where: { active: true, states: { has: state } },
      orderBy: { createdAt: "asc" },
    });

    if (zone) {
      const freeOver = zone.freeOverKobo == null ? null : Number(zone.freeOverKobo);
      const qualifiesFree = freeOver != null && subtotalKobo >= freeOver;
      return NextResponse.json(
        apiSuccess({
          state,
          zone: zone.name,
          etaDays: zone.etaDays,
          baseRateKobo: Number(zone.baseRateKobo),
          freeOverKobo: freeOver,
          shippingKobo: qualifiesFree ? 0 : Number(zone.baseRateKobo),
          qualifiesForFreeShipping: qualifiesFree,
          fallback: false,
        }),
      );
    }

    const fb = await db.fallbackShipping.findFirst();
    if (fb?.enabled) {
      return NextResponse.json(
        apiSuccess({
          state,
          zone: "Fallback",
          etaDays: fb.etaDays,
          baseRateKobo: Number(fb.flatRateKobo),
          freeOverKobo: null,
          shippingKobo: Number(fb.flatRateKobo),
          qualifiesForFreeShipping: false,
          fallback: true,
        }),
      );
    }

    // No zone, no fallback enabled — explicit "we don't ship there" answer.
    return NextResponse.json(
      apiSuccess({
        state,
        zone: null,
        etaDays: null,
        baseRateKobo: null,
        shippingKobo: null,
        qualifiesForFreeShipping: false,
        unavailable: true,
        message:
          "No active shipping zone covers this state. Recommend the customer contact us on WhatsApp for a custom quote.",
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
