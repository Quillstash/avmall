/**
 * POST /api/v1/admin/products/[slug]/stock-adjust
 *
 * Adjusts on-hand stock for a single variant by a signed delta. Writes an
 * audit log entry with before/after counts plus the reason and optional note.
 * Permission-gated by `products.stock_adjust`.
 *
 * Body:
 *   { variantId, delta, reason, note? }
 *
 * Response (200):
 *   { onHand: number, variantId: string }
 *
 * Errors:
 *   400 VALIDATION
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   409 STOCK_UNDERFLOW   — delta would drive onHand below 0
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { resolveStaffStoreId } from "@/lib/store";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  variantId: z.string().uuid("variantId must be a UUID"),
  delta: z
    .number()
    .int("Delta must be a whole number")
    .refine((n) => n !== 0, "Delta must be non-zero"),
  reason: z.enum(["restock", "correction", "damage", "return", "other"]),
  note: z.string().max(500).optional(),
  /** Store to adjust. Defaults to the operator's home store. */
  storeId: z.string().uuid().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.stock_adjust");

    const { slug } = params;

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const body = parsed.data;

    // Verify the variant belongs to the product (defence in depth — keeps
    // staff from juggling cross-product variant IDs via this endpoint).
    const product = await db.product.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
    if (!product) throw new NotFoundError(`Product ${slug}`);

    const storeId = body.storeId ?? (await resolveStaffStoreId(session));
    if (!storeId) {
      throw new AppError("NO_STORE", "No store to adjust stock for.", 400);
    }

    const result = await db.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: { id: body.variantId },
        select: { id: true, productId: true, label: true, sku: true },
      });
      if (!variant || variant.productId !== product.id) {
        throw new NotFoundError(`Variant ${body.variantId}`);
      }

      // Per-store stock. Adjusting at a store with no row yet creates it
      // (i.e. assigns the product to that store).
      const current = await tx.storeStock.findUnique({
        where: { storeId_variantId: { storeId, variantId: variant.id } },
        select: { onHand: true },
      });
      const prev = current?.onHand ?? 0;
      const next = prev + body.delta;
      if (next < 0) {
        throw new AppError(
          "STOCK_UNDERFLOW",
          `Cannot remove ${Math.abs(body.delta)} — only ${prev} on hand at this store.`,
          409,
        );
      }

      await tx.storeStock.upsert({
        where: { storeId_variantId: { storeId, variantId: variant.id } },
        update: { onHand: next },
        create: { storeId, variantId: variant.id, onHand: next, reserved: 0 },
      });

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "product.stock_adjust",
          entityType: "product_variant",
          entityId: variant.id,
          before: { onHand: prev },
          after: { onHand: next },
          metadata: {
            productId: product.id,
            productSlug: slug,
            storeId,
            variantLabel: variant.label,
            sku: variant.sku,
            delta: body.delta,
            reason: body.reason,
            ...(body.note && { note: body.note }),
          },
        },
        tx,
      );

      return { id: variant.id, onHand: next };
    });

    return NextResponse.json(
      apiSuccess({ variantId: result.id, onHand: result.onHand, storeId }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
