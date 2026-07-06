/**
 * GET /api/v1/ai/tools/shipping/quote?state=<state>&subtotalKobo=<n>
 *
 * Shipping rate + ETA for a Nigerian state. Optional subtotalKobo lets the
 * AI check whether the customer qualifies for free shipping. Falls back to
 * the flat rate when no zone covers the state.
 *
 * `state` is matched leniently (casing, a trailing "State", punctuation, and
 * every Abuja/FCT spelling) via lib/shipping-zone. The response echoes
 * `matchedState` — the canonical name to reuse in cart/quote and create_order
 * so their totals agree.
 *
 * Auth: public — read-only catalogue tool, no token required.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { findZoneForState, canonicalStateName } from "@/lib/shipping-zone";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Public tool: no auth required — read-only catalogue/quote data.

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Shipping quote requires DATABASE_URL.", 503);
    }

    const requestedState = req.nextUrl.searchParams.get("state")?.trim();
    if (!requestedState) {
      throw new ValidationError({ state: "state query parameter is required" });
    }
    const subtotalParam = Number(req.nextUrl.searchParams.get("subtotalKobo"));
    const subtotalKobo =
      Number.isFinite(subtotalParam) && subtotalParam >= 0 ? subtotalParam : 0;

    const matchedState = canonicalStateName(requestedState);
    const zone = await findZoneForState(requestedState);

    if (zone) {
      const freeOver = zone.freeOverKobo == null ? null : Number(zone.freeOverKobo);
      const qualifiesFree = freeOver != null && subtotalKobo >= freeOver;
      return NextResponse.json(
        apiSuccess({
          requestedState,
          matchedState: matchedState ?? requestedState,
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
          requestedState,
          matchedState: matchedState ?? requestedState,
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
        requestedState,
        matchedState,
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
