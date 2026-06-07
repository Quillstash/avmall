/**
 * PATCH /api/v1/admin/stores/[id]
 *
 * Update a store's details / status. The slug is immutable (it's the
 * storefront URL key). Setting a store as main unsets the previous main. The
 * main store can't be deactivated — promote another store first.
 *
 * Permission: stores.edit
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email("Invalid email").or(z.literal("")).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  isMain: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "stores.edit");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Stores require DATABASE_URL.", 503);
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new ValidationError({ [i?.path.join(".") ?? "body"]: i?.message ?? "Invalid" });
    }
    const b = parsed.data;

    const store = await db.store.findUnique({ where: { id: params.id } });
    if (!store) throw new NotFoundError("Store");

    // The main store anchors the storefront default + fallbacks — keep one
    // active main at all times.
    if (store.isMain && b.active === false) {
      throw new ConflictError("Set another store as main before deactivating this one.");
    }
    if (store.isMain && b.isMain === false) {
      throw new ConflictError("Promote another store to main instead of un-setting this one.");
    }

    const updated = await db.$transaction(async (tx) => {
      if (b.isMain === true && !store.isMain) {
        await tx.store.updateMany({ where: { isMain: true }, data: { isMain: false } });
      }
      const next = await tx.store.update({
        where: { id: store.id },
        data: {
          ...(b.name !== undefined && { name: b.name.trim() }),
          ...(b.phone !== undefined && { phone: b.phone?.trim() || null }),
          ...(b.email !== undefined && { email: b.email?.trim() || null }),
          ...(b.address !== undefined && { address: b.address?.trim() || null }),
          ...(b.city !== undefined && { city: b.city?.trim() || null }),
          ...(b.state !== undefined && { state: b.state?.trim() || null }),
          ...(b.isMain !== undefined && { isMain: b.isMain }),
          ...(b.active !== undefined && { active: b.active }),
        },
      });
      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "store.update",
          entityType: "store",
          entityId: store.id,
          before: { name: store.name, isMain: store.isMain, active: store.active },
          after: { name: next.name, isMain: next.isMain, active: next.active },
        },
        tx,
      );
      return next;
    });

    return NextResponse.json(
      apiSuccess({ store: { id: updated.id, slug: updated.slug, isMain: updated.isMain, active: updated.active } }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
