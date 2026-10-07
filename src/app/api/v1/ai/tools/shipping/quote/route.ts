/**
 * GET /api/v1/ai/tools/shipping/quote?state=<state>&lga=<area>&subtotal=<naira>
 *
 * Shipping rate + ETA for a Nigerian state. Optional `subtotal` (Naira; the
 * older `subtotalKobo` still works) lets the AI check whether the customer
 * qualifies for free shipping. Falls back to
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
import { hasDatabase } from "@/lib/db";
import { canonicalStateName, resolveShipping } from "@/lib/shipping-zone";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { formatMoney } from "@/lib/money";
import { nairaParamToKobo } from "@/lib/ai/naira-input";
import { DELIVERY_TBC, DELIVERY_TBC_MESSAGE, hasDeliveryPrice } from "@/lib/ai/delivery";
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
      nairaParamToKobo(req.nextUrl.searchParams.get("subtotal")) ??
      (Number.isFinite(subtotalParam) && subtotalParam >= 0 ? subtotalParam : 0);
    // Optional LGA/area — when given, an area-specific price beats the state one.
    const requestedLga = req.nextUrl.searchParams.get("lga")?.trim();

    const matchedState = canonicalStateName(requestedState) ?? requestedState;
    // The same resolver the cart and checkout charge by, so the agent can
    // never quote a fee the customer won't actually pay. (This route used to
    // read zones itself and quoted ₦0 zones as free, while checkout treats a
    // ₦0 rate as unset and charges the fallback.)
    const r = await resolveShipping({
      state: requestedState,
      lga: requestedLga,
      netSubtotalKobo: subtotalKobo,
    });

    if (!hasDeliveryPrice(r)) {
      // No price for this place (no zone, only the generic fallback, or a zone
      // left at ₦0): staff confirm the fee rather than the agent guessing one.
      return NextResponse.json(
        apiSuccess({
          requestedState,
          matchedState,
          ...(requestedLga && { requestedArea: requestedLga }),
          shipping: DELIVERY_TBC,
          deliveryFeeConfirmedByStaff: true,
          message: DELIVERY_TBC_MESSAGE,
        }),
      );
    }

    // They named an area we have no separate price for: this is the state's
    // general rate (or the fallback), not a price for that area.
    const areaNote =
      requestedLga && r.source !== "area"
        ? {
            areaMatched: false,
            areaMessage: `We don't have a specific delivery price for "${requestedLga}", so this is the general ${matchedState} rate. Say so, and that a member of our team will confirm the exact fee for ${requestedLga} if it differs.`,
          }
        : requestedLga
          ? { areaMatched: true }
          : {};

    return NextResponse.json(
      apiSuccess({
        requestedState,
        matchedState,
        zone: r.zone?.name ?? null,
        etaDays: r.zone?.etaDays ?? null,
        shipping: r.freeShippingEligible ? "Free" : formatMoney(r.shippingKobo),
        qualifiesForFreeShipping: r.freeShippingEligible,
        ...areaNote,
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
