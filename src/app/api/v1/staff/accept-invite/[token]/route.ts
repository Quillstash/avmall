/**
 * POST /api/v1/staff/accept-invite/[token]
 *
 * Public — anyone with a valid invite token can hit this. Validates the
 * token, hashes the supplied password, creates the User row, marks the
 * invitation accepted, and writes an audit log.
 *
 * Body: { password: string }
 *
 * Response: { email, role }   — caller then redirects to /admin-login
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

    const invitation = await db.staffInvitation.findUnique({
      where: { token: params.token },
    });
    if (!invitation) throw new NotFoundError("Invitation");
    if (invitation.acceptedAt) {
      throw new AppError(
        "INVITATION_USED",
        "This invitation has already been accepted. Sign in instead.",
        409,
      );
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new AppError(
        "INVITATION_EXPIRED",
        "This invitation has expired. Ask the admin to send a new one.",
        410,
      );
    }

    // Final guard — an admin could have created a User with this email
    // between the invite being sent and the recipient accepting.
    const existing = await db.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      throw new AppError(
        "USER_EXISTS",
        "An account already exists with this email. Sign in instead.",
        409,
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          roleId: invitation.roleId,
          passwordHash,
          active: true,
        },
        select: { id: true, email: true, role: true, name: true },
      });

      await tx.staffInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      await writeAudit(
        {
          actorUserId: created.id,
          actorType: "staff",
          action: "staff.invitation.accepted",
          entityType: "user",
          entityId: created.id,
          after: { email: created.email, role: created.role },
          metadata: {
            invitationId: invitation.id,
            invitedById: invitation.invitedById ?? undefined,
          },
        },
        tx,
      );

      return created;
    });

    return NextResponse.json(
      apiSuccess({ email: user.email, role: user.role, name: user.name }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
