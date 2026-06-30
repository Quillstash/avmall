/**
 * PATCH  /api/v1/admin/products/[slug]/variants/[variantId]
 * DELETE /api/v1/admin/products/[slug]/variants/[variantId]
 *
 * Edit an existing variant's price override, display label, and option values,
 * or delete a variant that has never been ordered.
 *
 * Editing is safe even on ordered variants: order_lines snapshot the name, SKU,
 * variant label, and unit price at purchase time, so past orders are never
 * rewritten. The SKU itself is intentionally not editable here (it's globally
 * unique and used for lookups). Deletion is only allowed for variants with no
 * order history, and never for a product's last remaining variant.
 *
 * Permission: products.edit
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const patchSchema = z.object({
  label: z.string().min(1).optional(),
  option1Value: z.string().trim().min(1).nullable().optional(),
  option2Value: z.string().trim().min(1).nullable().optional(),
  // null clears the override so the variant inherits the product price.
  priceOverrideKobo: z.number().int().positive().nullable().optional(),
});

/** Load the variant and confirm it belongs to the product addressed by the slug. */
async function loadVariant(slug: string, variantId: string) {
  const product = await db.product.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!product) throw new NotFoundError("Product");

  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      productId: true,
      label: true,
      sku: true,
      option1Value: true,
      option2Value: true,
      priceKobo: true,
    },
  });
  if (!variant || variant.productId !== product.id) {
    throw new NotFoundError("Variant");
  }
  return { product, variant };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; variantId: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.edit");

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const b = parsed.data;

    const { variant } = await loadVariant(params.slug, params.variantId);

    const updated = await db.productVariant.update({
      where: { id: variant.id },
      data: {
        ...(b.label !== undefined && { label: b.label }),
        ...(b.option1Value !== undefined && { option1Value: b.option1Value }),
        ...(b.option2Value !== undefined && { option2Value: b.option2Value }),
        ...(b.priceOverrideKobo !== undefined && {
          priceKobo:
            b.priceOverrideKobo === null ? null : BigInt(b.priceOverrideKobo),
        }),
      },
      select: {
        id: true,
        label: true,
        sku: true,
        option1Value: true,
        option2Value: true,
        priceKobo: true,
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "product.variant.update",
      entityType: "product_variant",
      entityId: variant.id,
      before: {
        label: variant.label,
        option1Value: variant.option1Value,
        option2Value: variant.option2Value,
        priceKobo: variant.priceKobo == null ? null : Number(variant.priceKobo),
      },
      after: {
        label: updated.label,
        option1Value: updated.option1Value,
        option2Value: updated.option2Value,
        priceKobo: updated.priceKobo == null ? null : Number(updated.priceKobo),
      },
    });

    return NextResponse.json(
      apiSuccess({
        variant: {
          id: updated.id,
          label: updated.label,
          sku: updated.sku,
          option1Value: updated.option1Value,
          option2Value: updated.option2Value,
          priceKobo: updated.priceKobo == null ? null : Number(updated.priceKobo),
        },
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string; variantId: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.edit");

    const { product, variant } = await loadVariant(
      params.slug,
      params.variantId,
    );

    // A variant on any order line carries purchase history — never delete it.
    const orderLineCount = await db.orderLine.count({
      where: { variantId: variant.id },
    });
    if (orderLineCount > 0) {
      throw new ConflictError(
        "This variant appears on past orders and can't be deleted. Set its stock to zero instead.",
      );
    }

    // Every product must keep at least one sellable variant.
    const remaining = await db.productVariant.count({
      where: { productId: product.id, archivedAt: null },
    });
    if (remaining <= 1) {
      throw new ConflictError(
        "A product must keep at least one variant. Add another before deleting this one.",
      );
    }

    await db.$transaction(async (tx) => {
      // StoreStock cascades on variant delete; StockReservation does not, so
      // clear any (necessarily order-less) reservations first.
      await tx.stockReservation.deleteMany({ where: { variantId: variant.id } });
      await tx.productVariant.delete({ where: { id: variant.id } });
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "product.variant.delete",
      entityType: "product_variant",
      entityId: variant.id,
      before: {
        productId: product.id,
        productSlug: product.slug,
        sku: variant.sku,
        label: variant.label,
        priceKobo: variant.priceKobo == null ? null : Number(variant.priceKobo),
      },
    });

    return NextResponse.json(apiSuccess({ deleted: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
