/**
 * POST /api/v1/admin/products/bulk-category
 *
 * Bulk-edit the category and/or brand of many selected products at once, so the
 * catalogue stays tidy and the storefront filters + the AI agent (which search
 * by category AND brand) reliably surface them.
 *
 * Body: { slugs: string[], categorySlug?: string, brand?: string } — at least
 * one of categorySlug / brand. To assign a NEW category, create it first via
 * POST /admin/categories and pass its slug here. Requires products.edit; the
 * change is audited once for the whole batch.
 *
 * NOTE: products are only visible on the storefront / to the AI once PUBLISHED
 * (they default to draft). Categorising a draft won't surface it until it's
 * published — that's the usual cause of a "0 products in this category".
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    slugs: z.array(z.string().min(1)).min(1, "Select at least one product").max(500),
    categorySlug: z.string().min(1).optional(),
    brand: z.string().trim().min(1).max(80).optional(),
  })
  .refine((b) => b.categorySlug || b.brand, {
    message: "Choose a category or set a brand",
    path: ["categorySlug"],
  });

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.edit");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({ [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid" });
    }
    const { slugs, categorySlug, brand } = parsed.data;

    const result = await db.$transaction(async (tx) => {
      let category: { id: string; slug: string; name: string } | null = null;
      if (categorySlug) {
        category = await tx.category.findUnique({
          where: { slug: categorySlug },
          select: { id: true, slug: true, name: true },
        });
        if (!category) throw new NotFoundError("Category");
      }

      const data: Prisma.ProductUncheckedUpdateManyInput = {};
      if (category) data.categoryId = category.id;
      if (brand) data.brand = brand;

      const affected = await tx.product.findMany({
        where: { slug: { in: slugs } },
        select: { id: true },
      });

      if (affected.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: affected.map((p) => p.id) } },
          data,
        });
        await writeAudit(
          {
            actorUserId: session.id,
            actorType: "staff",
            action: "product.bulk_update",
            entityType: "product",
            entityId: affected[0]!.id,
            before: { count: affected.length },
            after: {
              count: affected.length,
              ...(category && { category: category.slug }),
              ...(brand && { brand }),
            },
          },
          tx,
        );
      }

      return {
        updated: affected.length,
        requested: slugs.length,
        ...(category && { category: { slug: category.slug, name: category.name } }),
        ...(brand && { brand }),
      };
    });

    return NextResponse.json(apiSuccess(result));
  } catch (err) {
    return handleApiError(err);
  }
}
