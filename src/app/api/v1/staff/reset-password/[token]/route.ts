/**
 * POST /api/v1/staff/reset-password/[token]
 *
 * Public. Consumes the token, hashes the new password, updates the user, and
 * marks every other outstanding reset for the same user as used (defence
 * against multi-email enumeration replays).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }

    const reset = await db.passwordReset.findUnique({
      where: { token: params.token },
    });
    if (!reset) throw new NotFoundError("Reset link");
    if (reset.usedAt) {
      throw new AppError("RESET_USED", "This reset link has already been used.", 409);
    }
    if (reset.expiresAt.getTime() < Date.now()) {
      throw new AppError("RESET_EXPIRED", "This reset link has expired.", 410);
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      });
      // Burn this token + invalidate any other outstanding ones for this user.
      await tx.passwordReset.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await writeAudit(
        {
          actorUserId: reset.userId,
          actorType: "staff",
          action: "staff.password_reset.applied",
          entityType: "user",
          entityId: reset.userId,
        },
        tx,
      );
    });

    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
