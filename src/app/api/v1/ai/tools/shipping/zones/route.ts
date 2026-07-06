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
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Public tool: no auth required — read-only shipping info.

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Shipping zones require DATABASE_URL.", 503);
    }

    const [zones, fb] = await Promise.all([
      db.shippingZone.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
      db.fallbackShipping.findFirst(),
    ]);

    return NextResponse.json(
      apiSuccess({
        currency: "NGN",
        zones: zones.map((z) => {
          const rate = Number(z.baseRateKobo);
          const freeOver = z.freeOverKobo == null ? null : Number(z.freeOverKobo);
          return {
            name: z.name,
            states: z.states,
            baseRateKobo: rate,
            displayRate: formatMoney(rate),
            freeOverKobo: freeOver,
            ...(freeOver != null && { freeOverDisplay: formatMoney(freeOver) }),
            etaDays: z.etaDays,
          };
        }),
        fallback:
          fb?.enabled
            ? {
                flatRateKobo: Number(fb.flatRateKobo),
                displayRate: formatMoney(Number(fb.flatRateKobo)),
                etaDays: fb.etaDays,
                note: "Applied to any state not covered by a zone above.",
              }
            : null,
        message:
          "These are the live delivery prices from admin. Amounts are in kobo; divide by 100 for naira. Match the customer's state to a zone; if none covers it, the fallback applies (or shipping is unavailable when there is no fallback).",
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
