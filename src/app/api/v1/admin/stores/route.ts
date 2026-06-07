/**
 * POST /api/v1/admin/stores
 *
 * Create a physical store. Slug is derived from the name (unique). Setting a
 * store as main unsets the previous main in the same transaction.
 *
 * Permission: stores.create
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

const bodySchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  isMain: z.boolean().optional(),
  active: z.boolean().optional(),
});

/** Lowercase, hyphenated, alphanumeric slug. */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "store"
  );
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "stores.create");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Stores require DATABASE_URL.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new ValidationError({ [i?.path.join(".") ?? "body"]: i?.message ?? "Invalid" });
    }
    const b = parsed.data;

    // Unique slug — append -2, -3, … on collision.
    const base = slugify(b.name);
    let slug = base;
    let n = 1;
    while (await db.store.findUnique({ where: { slug }, select: { id: true } })) {
      n += 1;
      slug = `${base}-${n}`;
    }

    const store = await db.$transaction(async (tx) => {
      if (b.isMain) {
        await tx.store.updateMany({ where: { isMain: true }, data: { isMain: false } });
      }
      const created = await tx.store.create({
        data: {
          name: b.name.trim(),
          slug,
          isMain: b.isMain ?? false,
          active: b.active ?? true,
          phone: b.phone?.trim() || null,
          email: b.email?.trim() || null,
          address: b.address?.trim() || null,
          city: b.city?.trim() || null,
          state: b.state?.trim() || null,
        },
      });
      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "store.create",
          entityType: "store",
          entityId: created.id,
          after: { name: created.name, slug: created.slug, isMain: created.isMain },
        },
        tx,
      );
      return created;
    });

    return NextResponse.json(
      apiSuccess({ store: { id: store.id, slug: store.slug } }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
