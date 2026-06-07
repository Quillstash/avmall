/**
 * PATCH  /api/v1/admin/products/:slug   Update product fields.
 * DELETE /api/v1/admin/products/:slug   Hard delete (only when never sold).
 *                                       Use /archive for the soft-delete path.
 *
 * For pricing changes, requires `products.edit_pricing`; for everything else
 * `products.edit`. Stock count changes the default variant's on_hand and
 * goes through `products.stock_adjust`.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { resolveStaffStoreId } from "@/lib/store";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  categorySlug: z.string().min(1).optional(),
  shortDesc: z.string().optional(),
  longDesc: z.string().optional(),
  themeBg: z.string().nullable().optional(),
  priceKobo: z.number().int().positive().optional(),
  /** Internal cost of goods (kobo). */
  costPriceKobo: z.number().int().nonnegative().optional(),
  saleKobo: z.number().int().positive().nullable().optional(),
  saleActive: z.boolean().optional(),
  /** Default-variant stock. */
  stock: z.number().int().nonnegative().optional(),
  negotiate: z.boolean().optional(),
  /** Per-product negotiation cap — flat floor (kobo). Null clears. */
  negotiateFloorKobo: z.number().int().nonnegative().nullable().optional(),
  /** Per-product negotiation cap — max % off retail (0–50). Null clears. */
  negotiateMaxPct: z.number().int().min(0).max(50).nullable().optional(),
  preorder: z.boolean().optional(),
  moq: z.number().int().positive().nullable().optional(),
  eta: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  /** Bulk tier replacement — wipe + rewrite. */
  bulkTiers: z
    .array(
      z.object({
        min: z.number().int().positive(),
        max: z.number().int().positive().nullable().default(null),
        type: z.enum(["percentage", "fixed"]),
        value: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  /** Image set replacement — wipe + rewrite. Order = position. The first
   *  entry is the primary unless one has `primary: true`. */
  images: z
    .array(
      z.object({
        key: z.string().min(1),
        alt: z.string().optional(),
        primary: z.boolean().optional(),
      }),
    )
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } },
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

    // Pricing changes need a separate permission check.
    const touchingPricing =
      b.priceKobo !== undefined || b.saleKobo !== undefined || b.saleActive !== undefined;
    if (touchingPricing && !hasPermission(session, "products.edit_pricing")) {
      throw new ForbiddenError("Missing permission: products.edit_pricing");
    }

    const touchingStock = b.stock !== undefined;
    if (touchingStock && !hasPermission(session, "products.stock_adjust")) {
      throw new ForbiddenError("Missing permission: products.stock_adjust");
    }

    const updated = await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { slug: params.slug },
        include: { variants: { orderBy: { position: "asc" } } },
      });
      if (!product) throw new NotFoundError("Product");

      let categoryId: string | undefined;
      if (b.categorySlug && b.categorySlug !== "") {
        const cat = await tx.category.findUnique({ where: { slug: b.categorySlug } });
        if (!cat) throw new NotFoundError(`Category ${b.categorySlug}`);
        categoryId = cat.id;
      }

      const before = {
        name: product.name,
        priceKobo: Number(product.priceKobo),
        saleActive: product.saleActive,
        published: product.published,
      };

      const next = await tx.product.update({
        where: { id: product.id },
        data: {
          ...(b.name !== undefined && { name: b.name }),
          ...(b.brand !== undefined && { brand: b.brand }),
          ...(categoryId !== undefined && { categoryId }),
          ...(b.shortDesc !== undefined && { shortDesc: b.shortDesc }),
          ...(b.longDesc !== undefined && { longDesc: b.longDesc }),
          ...(b.themeBg !== undefined && { themeBg: b.themeBg }),
          ...(b.priceKobo !== undefined && { priceKobo: BigInt(b.priceKobo) }),
          ...(b.costPriceKobo !== undefined && {
            costPriceKobo: BigInt(b.costPriceKobo),
          }),
          ...(b.saleKobo !== undefined && {
            saleKobo: b.saleKobo == null ? null : BigInt(b.saleKobo),
          }),
          ...(b.saleActive !== undefined && { saleActive: b.saleActive }),
          ...(b.negotiate !== undefined && { negotiate: b.negotiate }),
          ...(b.negotiateFloorKobo !== undefined && {
            negotiateFloorKobo:
              b.negotiateFloorKobo == null ? null : BigInt(b.negotiateFloorKobo),
          }),
          ...(b.negotiateMaxPct !== undefined && { negotiateMaxPct: b.negotiateMaxPct }),
          ...(b.preorder !== undefined && { preorder: b.preorder }),
          ...(b.moq !== undefined && { moq: b.moq }),
          ...(b.eta !== undefined && { eta: b.eta }),
          ...(b.tags !== undefined && { tags: b.tags }),
          ...(b.published !== undefined && { published: b.published }),
          ...(b.featured !== undefined && { featured: b.featured }),
        },
      });

      // Update default-variant stock if asked — per-store, at the operator's
      // store (upsert so a store without a row yet gets one).
      if (b.stock !== undefined && product.variants[0]) {
        const storeId = await resolveStaffStoreId(session);
        if (storeId) {
          await tx.storeStock.upsert({
            where: {
              storeId_variantId: { storeId, variantId: product.variants[0].id },
            },
            update: { onHand: b.stock },
            create: {
              storeId,
              variantId: product.variants[0].id,
              onHand: b.stock,
              reserved: 0,
            },
          });
        }
      }

      // Replace bulk tiers wholesale (simpler than diffing).
      if (b.bulkTiers !== undefined) {
        await tx.bulkTier.deleteMany({ where: { productId: product.id } });
        if (b.bulkTiers.length > 0) {
          await tx.bulkTier.createMany({
            data: b.bulkTiers.map((t) => ({
              productId: product.id,
              min: t.min,
              max: t.max,
              type: t.type,
              value: t.value,
            })),
          });
        }
      }

      // Replace the image set wholesale. R2 objects for removed images are
      // left in place — deletion would race a CDN edge that's still serving
      // a cached version. A nightly worker can sweep orphans later.
      if (b.images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: product.id } });
        if (b.images.length > 0) {
          await tx.productImage.createMany({
            data: b.images.map((img, i) => ({
              productId: product.id,
              key: img.key,
              alt: img.alt ?? null,
              position: i,
              isPrimary: img.primary ?? i === 0,
            })),
          });
        }
      }

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "product.update",
          entityType: "product",
          entityId: product.id,
          before,
          after: {
            name: next.name,
            priceKobo: Number(next.priceKobo),
            saleActive: next.saleActive,
            published: next.published,
          },
        },
        tx,
      );

      return next;
    });

    return NextResponse.json(
      apiSuccess({ product: { id: updated.id, slug: updated.slug } }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.delete");

    const product = await db.product.findUnique({
      where: { slug: params.slug },
      include: { orderLines: { take: 1 } },
    });
    if (!product) throw new NotFoundError("Product");

    if (product.orderLines.length > 0) {
      throw new ConflictError(
        "Product has order history — archive it instead of deleting to preserve audit trail",
      );
    }

    await db.product.delete({ where: { id: product.id } });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "product.delete",
      entityType: "product",
      entityId: product.id,
      before: { slug: product.slug, name: product.name },
    });

    return NextResponse.json(apiSuccess({ deleted: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
