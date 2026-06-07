/**
 * POST /api/v1/admin/products/[slug]/variants
 *
 * Add a new variant to an existing product. Renaming or deleting variants
 * with order history would break the order_lines snapshot trail, so this
 * endpoint only adds — use /stock-adjust for stock changes on existing rows,
 * and archive the product if a SKU is being permanently retired.
 *
 * Permission: products.edit
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { resolveStaffStoreId } from "@/lib/store";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  label: z.string().min(1),
  sku: z.string().min(1),
  option1Value: z.string().nullable().optional(),
  option2Value: z.string().nullable().optional(),
  stock: z.number().int().nonnegative().default(0),
  priceOverrideKobo: z.number().int().positive().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.edit");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const b = parsed.data;

    const product = await db.product.findUnique({
      where: { slug: params.slug },
      include: {
        variants: {
          orderBy: { position: "desc" },
          take: 1,
          select: { position: true },
        },
      },
    });
    if (!product) throw new NotFoundError("Product");

    // SKU is globally unique. Catch a collision before Prisma does, so we can
    // return a clean validation error instead of a 500.
    const existing = await db.productVariant.findUnique({
      where: { sku: b.sku },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError(`SKU "${b.sku}" already exists`);
    }

    const position = (product.variants[0]?.position ?? -1) + 1;
    const storeId = await resolveStaffStoreId(session);

    const variant = await db.$transaction(async (tx) => {
      const v = await tx.productVariant.create({
        data: {
          productId: product.id,
          label: b.label,
          sku: b.sku,
          ...(b.option1Value && { option1Value: b.option1Value }),
          ...(b.option2Value && { option2Value: b.option2Value }),
          ...(b.priceOverrideKobo != null && {
            priceKobo: BigInt(b.priceOverrideKobo),
          }),
          position,
        },
      });
      // Seed the new variant's opening stock at the operator's store.
      if (storeId) {
        await tx.storeStock.create({
          data: { storeId, variantId: v.id, onHand: b.stock, reserved: 0 },
        });
      }
      return v;
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "product.variant.create",
      entityType: "product_variant",
      entityId: variant.id,
      after: {
        productId: product.id,
        productSlug: product.slug,
        sku: variant.sku,
        label: variant.label,
        onHand: b.stock,
        storeId,
      },
    });

    return NextResponse.json(
      apiSuccess({
        variant: {
          id: variant.id,
          label: variant.label,
          sku: variant.sku,
          stock: b.stock,
        },
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
