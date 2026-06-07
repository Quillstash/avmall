/**
 * PATCH  /api/v1/admin/couriers/[id]   Update a courier (name, contact, status).
 * DELETE /api/v1/admin/couriers/[id]   Remove a courier.
 *
 * Setting a courier primary unsets the previous primary.
 * Permission: shipping.edit
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  trackingUrl: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  active: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "shipping.edit");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Couriers require DATABASE_URL.", 503);
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new ValidationError({ [i?.path.join(".") ?? "body"]: i?.message ?? "Invalid" });
    }
    const b = parsed.data;

    const existing = await db.courier.findUnique({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Courier");

    const updated = await db.$transaction(async (tx) => {
      if (b.isPrimary === true && !existing.isPrimary) {
        await tx.courier.updateMany({ where: { isPrimary: true }, data: { isPrimary: false } });
      }
      const next = await tx.courier.update({
        where: { id: existing.id },
        data: {
          ...(b.name !== undefined && { name: b.name.trim() }),
          ...(b.phone !== undefined && { phone: b.phone?.trim() || null }),
          ...(b.trackingUrl !== undefined && { trackingUrl: b.trackingUrl?.trim() || null }),
          ...(b.note !== undefined && { note: b.note?.trim() || null }),
          ...(b.active !== undefined && { active: b.active }),
          ...(b.isPrimary !== undefined && { isPrimary: b.isPrimary }),
        },
      });
      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "courier.update",
          entityType: "courier",
          entityId: existing.id,
          before: { name: existing.name, active: existing.active, isPrimary: existing.isPrimary },
          after: { name: next.name, active: next.active, isPrimary: next.isPrimary },
        },
        tx,
      );
      return next;
    });

    return NextResponse.json(apiSuccess({ courier: { id: updated.id } }));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "shipping.edit");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Couriers require DATABASE_URL.", 503);
    }

    const existing = await db.courier.findUnique({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Courier");

    await db.courier.delete({ where: { id: params.id } });
    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "courier.delete",
      entityType: "courier",
      entityId: existing.id,
      before: { name: existing.name },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
