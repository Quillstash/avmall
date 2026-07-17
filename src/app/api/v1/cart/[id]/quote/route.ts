/**
 * POST /api/v1/cart/:id/quote
 *
 * Same as POST /api/v1/cart/quote but also stamps the Cart row with the
 * latest quote id so checkout can detect drift. Used by server-side cart
 * surfaces (admin order builder); the storefront uses the no-ID variant.
 *
 * See /api/v1/cart/quote and CLAUDE.md §12.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { quoteFromProductIds } from "@/lib/cart-quote";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

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

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Cart quote requires DATABASE_URL.",
        503,
      );
    }

    const result = await quoteFromProductIds(db, parsed.data);

    // Stamp the cart row so checkout can verify the quote hasn't drifted.
    // The Cart record may not exist (the storefront uses a browser-local
    // cart) — swallow the P2025, it's a best-effort write.
    const quoteId = crypto.randomUUID();
    await db.cart
      .update({
        where: { id: params.id },
        data: { lastQuoteId: quoteId, updatedAt: new Date() },
      })
      .catch(() => undefined);

    return NextResponse.json(apiSuccess({ ...result, quoteId }));
  } catch (err) {
    return handleApiError(err);
  }
}
