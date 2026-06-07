/**
 * POST   /api/v1/admin/staff/invitations/[id]   Resend the invite (new token, +7d).
 * DELETE /api/v1/admin/staff/invitations/[id]    Revoke a pending invite.
 *
 * Permission: staff.create (same as inviting).
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { staffInvitationEmail } from "@/lib/email-templates";
import { SITE } from "@/lib/site";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

const INVITE_TTL_DAYS = 7;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "staff.create");

    const inv = await db.staffInvitation.findUnique({ where: { id: params.id } });
    if (!inv) throw new NotFoundError("Invitation");
    if (inv.acceptedAt) {
      throw new ConflictError("This invitation was already accepted.");
    }

    const token = crypto.randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    await db.staffInvitation.update({
      where: { id: inv.id },
      data: { token, expiresAt },
    });

    const acceptUrl = `${SITE.url}/accept-invite/${token}`;
    const { subject, html, text } = staffInvitationEmail({
      recipientName: inv.name,
      inviterName: session.name ?? "An admin",
      role: inv.role,
      acceptUrl,
      expiresAt,
    });
    const send = await sendEmail({
      to: inv.email,
      subject,
      html,
      text,
      tags: [{ name: "kind", value: "staff-invite" }],
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "staff.invitation.resent",
      entityType: "staff_invitation",
      entityId: inv.id,
      after: { email: inv.email, emailSent: send.ok, emailSkipped: !!send.skipped },
    });

    return NextResponse.json(
      apiSuccess({
        email: {
          delivered: send.ok && !send.skipped,
          skipped: !!send.skipped,
          ...(send.error && { error: send.error }),
        },
      }),
    );
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
    requirePermission(session, "staff.create");

    const inv = await db.staffInvitation.findUnique({ where: { id: params.id } });
    if (!inv) throw new NotFoundError("Invitation");
    if (inv.acceptedAt) {
      throw new ConflictError(
        "This invitation was already accepted — disable the staff member instead.",
      );
    }

    await db.staffInvitation.delete({ where: { id: inv.id } });
    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "staff.invitation.revoked",
      entityType: "staff_invitation",
      entityId: inv.id,
      before: { email: inv.email, role: inv.role },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
