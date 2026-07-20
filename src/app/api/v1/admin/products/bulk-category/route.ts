/**
 * POST /api/v1/admin/products/bulk-category
 *
 * Assign many products to a single category at once — staff multi-select in the
 * products list and pick a category. Keeps the catalogue tidy so the storefront
 * filters and the AI agent (which searches by category) reliably surface them.
 *
 * Body: { slugs: string[], categorySlug: string }. Requires products.edit.
 * Only products not already in the target category are moved; the change is
 * audited once for the whole batch.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  slugs: z.array(z.string().min(1)).min(1, "Select at least one product").max(500),
  categorySlug: z.string().min(1, "Pick a category"),
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
    const { slugs, categorySlug } = parsed.data;

    const result = await db.$transaction(async (tx) => {
      const category = await tx.category.findUnique({ where: { slug: categorySlug } });
      if (!category) throw new NotFoundError("Category");

      const products = await tx.product.findMany({
        where: { slug: { in: slugs } },
        select: {
          id: true,
          slug: true,
          categoryId: true,
          category: { select: { slug: true } },
        },
      });

      // Only move products that aren't already in the target category.
      const toMove = products.filter((p) => p.categoryId !== category.id);
      if (toMove.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: toMove.map((p) => p.id) } },
          data: { categoryId: category.id },
        });
        await writeAudit(
          {
            actorUserId: session.id,
            actorType: "staff",
            action: "product.bulk_categorize",
            entityType: "category",
            entityId: category.id,
            before: {
              products: toMove.map((p) => ({ slug: p.slug, category: p.category?.slug ?? null })),
            },
            after: { category: category.slug, count: toMove.length },
          },
          tx,
        );
      }

      return {
        updated: toMove.length,
        requested: slugs.length,
        category: { slug: category.slug, name: category.name },
      };
    });

    return NextResponse.json(apiSuccess(result));
  } catch (err) {
    return handleApiError(err);
  }
}
