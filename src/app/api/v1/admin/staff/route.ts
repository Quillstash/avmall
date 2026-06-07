/**
 * POST /api/v1/admin/staff
 *
 * Invite a new staff member. Creates a StaffInvitation row + emails the
 * recipient a one-time link to set their password. The actual User row is
 * only created when they accept (`POST /api/v1/staff/accept-invite/[token]`).
 *
 * Permission: staff.create
 *
 * Body:
 *   { email: string, name: string, role: StaffRole }
 *
 * Response (201): { invitation: { id, email, role, expiresAt } }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission, enumForSlug } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { staffInvitationEmail } from "@/lib/email-templates";
import { SITE } from "@/lib/site";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const INVITE_TTL_DAYS = 7;

const bodySchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  name: z.string().min(1).max(120),
  roleId: z.string().uuid("Pick a role"),
});

function makeToken(): string {
  // 48-byte base64url ≈ 64 chars. Long enough that brute-forcing is hopeless.
  return crypto.randomBytes(48).toString("base64url");
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "staff.create");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const { email, name, roleId } = parsed.data;

    const role = await db.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundError("Role");
    const roleEnum = enumForSlug(role.slug);

    // Refuse if a User with this email already exists. (Staff are unique on
    // email; super-admins can resend a password reset for active staff.)
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictError(
        `${email} already has an account — use the password reset flow instead`,
      );
    }

    // Reuse an outstanding invite for the same email rather than stacking
    // dead rows. Replace the token + bump the expiry — the email gets
    // re-sent so the previous link stops working.
    const existing = await db.staffInvitation.findFirst({
      where: { email, acceptedAt: null },
    });

    const token = makeToken();
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const invitation = existing
      ? await db.staffInvitation.update({
          where: { id: existing.id },
          data: { token, expiresAt, name, role: roleEnum, roleId: role.id, invitedById: session.id },
        })
      : await db.staffInvitation.create({
          data: {
            email,
            name,
            role: roleEnum,
            roleId: role.id,
            token,
            expiresAt,
            invitedById: session.id,
          },
        });

    const acceptUrl = `${SITE.url}/accept-invite/${token}`;
    const { subject, html, text } = staffInvitationEmail({
      recipientName: name,
      inviterName: session.name ?? "An admin",
      role: role.name,
      acceptUrl,
      expiresAt,
    });

    const send = await sendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [
        { name: "kind", value: "staff-invite" },
        { name: "role", value: role.slug },
      ],
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: existing ? "staff.invitation.resent" : "staff.invitation.sent",
      entityType: "staff_invitation",
      entityId: invitation.id,
      after: {
        email,
        role: role.slug,
        expiresAt: invitation.expiresAt.toISOString(),
        emailSent: send.ok,
        emailSkipped: !!send.skipped,
      },
    });

    return NextResponse.json(
      apiSuccess({
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
        },
        email: {
          delivered: send.ok && !send.skipped,
          skipped: !!send.skipped,
          ...(send.error && { error: send.error }),
        },
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
