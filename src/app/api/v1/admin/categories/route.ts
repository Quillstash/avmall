/**
 * GET  /api/v1/admin/categories   List categories (for product forms).
 * POST /api/v1/admin/categories   Create a category (e.g. inline from the
 *                                 product create page).
 *
 * Permission: products.view (list) / products.create (create)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "category"
  );
}

export async function GET() {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.view");
    if (!hasDatabase) return NextResponse.json(apiSuccess({ categories: [] }));

    const categories = await db.category.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { slug: true, name: true },
    });
    return NextResponse.json(apiSuccess({ categories }));
  } catch (err) {
    return handleApiError(err);
  }
}

const bodySchema = z.object({
  name: z.string().min(1, "Category name is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.create");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Categories require DATABASE_URL.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError({
        name: parsed.error.issues[0]?.message ?? "Invalid",
      });
    }
    const name = parsed.data.name.trim();

    // Unique slug — append -2, -3, … on collision.
    const base = slugify(name);
    let slug = base;
    let n = 1;
    while (await db.category.findUnique({ where: { slug }, select: { id: true } })) {
      n += 1;
      slug = `${base}-${n}`;
    }

    const maxPos = await db.category.aggregate({ _max: { position: true } });
    const category = await db.category.create({
      data: { name, slug, position: (maxPos._max.position ?? 0) + 1 },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "category.create",
      entityType: "category",
      entityId: category.id,
      after: { name: category.name, slug: category.slug },
    });

    return NextResponse.json(
      apiSuccess({ category: { slug: category.slug, name: category.name } }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
