/**
 * PATCH  /api/v1/admin/roles/[id]   Edit a role (name, description, permissions).
 * DELETE /api/v1/admin/roles/[id]   Delete a custom role (not system, no users).
 *
 * System roles can have their name/description/permissions edited but cannot be
 * deleted, and their slug is immutable (the legacy enum maps to it).
 *
 * Permission: roles.manage
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission, cleanPermissions } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  permissions: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "roles.manage");
    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Roles require DATABASE_URL.", 503);
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new ValidationError({ [i?.path.join(".") ?? "body"]: i?.message ?? "Invalid" });
    }
    const b = parsed.data;

    const existing = await db.role.findUnique({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Role");

    const updated = await db.role.update({
      where: { id: existing.id },
      data: {
        ...(b.name !== undefined && { name: b.name.trim() }),
        ...(b.description !== undefined && { description: b.description?.trim() || null }),
        ...(b.permissions !== undefined && { permissions: cleanPermissions(b.permissions) }),
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "role.update",
      entityType: "role",
      entityId: existing.id,
      before: { name: existing.name, permissions: existing.permissions.length },
      after: { name: updated.name, permissions: updated.permissions.length },
    });

    return NextResponse.json(apiSuccess({ role: { id: updated.id } }));
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
    requirePermission(session, "roles.manage");
    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Roles require DATABASE_URL.", 503);
    }

    const existing = await db.role.findUnique({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Role");
    if (existing.isSystem) {
      throw new ConflictError("System roles can't be deleted.");
    }

    const assigned = await db.user.count({ where: { roleId: existing.id } });
    if (assigned > 0) {
      throw new ConflictError(
        `Reassign the ${assigned} staff member${assigned === 1 ? "" : "s"} on this role before deleting it.`,
      );
    }

    await db.role.delete({ where: { id: existing.id } });
    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "role.delete",
      entityType: "role",
      entityId: existing.id,
      before: { name: existing.name, slug: existing.slug },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
