/**
 * GET   /api/v1/admin/me   Current staff profile.
 * PATCH /api/v1/admin/me   Update name and/or password (verifies current).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "New password must be at least 8 characters").optional(),
  })
  .refine(
    (b) => !b.newPassword || !!b.currentPassword,
    { message: "Current password is required to set a new one", path: ["currentPassword"] },
  )
  .refine(
    (b) => b.name !== undefined || b.newPassword !== undefined,
    { message: "Nothing to update", path: ["body"] },
  );

export async function GET() {
  try {
    const session = await requireStaffSession();
    if (!hasDatabase) {
      return NextResponse.json(
        apiSuccess({
          id: session.id,
          email: session.email,
          name: session.name,
          role: session.role,
          lastSeenAt: null,
        }),
      );
    }
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastSeenAt: true,
      },
    });
    if (!user) {
      throw new AppError("NOT_FOUND", "User no longer exists", 404);
    }
    return NextResponse.json(apiSuccess(user));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Profile edits require DATABASE_URL.", 503);
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const b = parsed.data;

    const user = await db.user.findUnique({ where: { id: session.id } });
    if (!user) throw new AppError("NOT_FOUND", "User no longer exists", 404);

    // Verify current password if rotating
    if (b.newPassword) {
      const ok = await bcrypt.compare(b.currentPassword!, user.passwordHash);
      if (!ok) {
        throw new ValidationError({ currentPassword: "Current password is incorrect" });
      }
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.newPassword && { passwordHash: await bcrypt.hash(b.newPassword, 10) }),
      },
      select: { id: true, email: true, name: true, role: true },
    });

    await writeAudit({
      actorUserId: user.id,
      actorType: "staff",
      action: "user.self_update",
      entityType: "user",
      entityId: user.id,
      before: { name: user.name },
      after: {
        name: updated.name,
        passwordChanged: !!b.newPassword,
      },
    });

    return NextResponse.json(apiSuccess(updated));
  } catch (err) {
    return handleApiError(err);
  }
}
