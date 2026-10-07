/**
 * GET /api/v1/ai/tools/shipping/zones
 *
 * The full shipping price table exactly as configured in admin: every active
 * zone with the states it covers, its base rate, free-shipping threshold and
 * ETA, plus the flat-rate fallback. Lets the AI answer "what are your delivery
 * prices?" accurately and match a customer's location against the real list.
 *
 * For a single-state answer, prefer GET /shipping/quote (it also handles free
 * shipping + fuzzy state matching).
 *
 * Auth: public — read-only shipping info, no token required (matches
 * shipping/quote and the other read-only catalogue tools).
 */

import { NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { DELIVERY_TBC, DELIVERY_TBC_MESSAGE } from "@/lib/ai/delivery";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Public tool: no auth required — read-only shipping info.

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Shipping zones require DATABASE_URL.", 503);
    }

    const zones = await db.shippingZone.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      apiSuccess({
        currency: "NGN",
        zones: zones.map((z) => {
          const rate = Number(z.baseRateKobo);
          const freeOver = z.freeOverKobo == null ? null : Number(z.freeOverKobo);
          // Checkout treats a ₦0 rate as "not set" and charges the fallback
          // instead (lib/shipping-zone resolveShipping) — say that, rather
          // than letting the agent promise free delivery checkout won't give.
          if (rate <= 0) {
            return {
              name: z.name,
              states: z.states,
              rate: DELIVERY_TBC,
              note: "No delivery price set for this zone: a member of our team confirms the fee with the customer.",
              etaDays: z.etaDays,
            };
          }
          return {
            name: z.name,
            states: z.states,
            rate: formatMoney(rate),
            freeOver: freeOver != null ? formatMoney(freeOver) : null,
            etaDays: z.etaDays,
          };
        }),
        // The flat fallback is a placeholder, not a price for anywhere in
        // particular — so outside the zones above, staff confirm the fee.
        otherLocations: DELIVERY_TBC_MESSAGE,
        message:
          "These are the live delivery prices from admin, already in naira — show them exactly as given. Match the customer's state to a zone; for anywhere no zone covers, a member of our team confirms the delivery fee.",
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
