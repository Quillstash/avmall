/**
 * POST /api/v1/cart/quote
 *
 * Server-authoritative cart totals for the storefront. The client never
 * computes the total itself — it always calls this endpoint before showing
 * the user a number. See CLAUDE.md §12.
 *
 * Sibling of /api/v1/cart/[id]/quote (which also stamps the Cart row);
 * this no-ID variant exists because the storefront cart is browser-local
 * (localStorage / Zustand) and has no server-side Cart record.
 *
 * Body:
 *   {
 *     items: [{ productId, variantId, quantity }],
 *     couponCode?: string,
 *     state?: string,              // Nigerian state for shipping zone match
 *   }
 *
 * Response:
 *   { quote: Quote, couponApplied?, couponRejected?, shippingZone? }
 *
 * Errors:
 *   404 NOT_FOUND        — product/variant archived or unknown
 *   422 COUPON_INVALID   — coupon expired or used up
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { quoteFromProductIds } from "@/lib/cart-quote";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

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
  lga: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError({
        body: parsed.error.issues[0]?.message ?? "Invalid body",
      });
    }

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Cart quote requires DATABASE_URL.",
        503,
      );
    }

    const result = await quoteFromProductIds(db, parsed.data);
    return NextResponse.json(apiSuccess(result));
  } catch (err) {
    return handleApiError(err);
  }
}
