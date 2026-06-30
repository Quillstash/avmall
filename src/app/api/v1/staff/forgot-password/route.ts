/**
 * POST /api/v1/staff/forgot-password
 *
 * Public. Generates a single-use 30-minute reset token for the given email,
 * emails the link, and always returns 200 — even if no user matches, so
 * attackers can't enumerate staff emails.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { db, hasDatabase } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { staffPasswordResetEmail } from "@/lib/email-templates";
import { writeAudit } from "@/lib/audit";
import { SITE } from "@/lib/site";
import { appUrl } from "@/lib/app-url";
import { apiSuccess, handleApiError } from "@/lib/api-response";

export const runtime = "nodejs";

const RESET_TTL_MIN = 30;

const bodySchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      // Validation error — but mask it to avoid enumeration. Always look
      // like success.
      return NextResponse.json(apiSuccess({ ok: true }));
    }
    const { email } = parsed.data;

    if (!hasDatabase) {
      return NextResponse.json(apiSuccess({ ok: true, mock: true }));
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      // Always return success — never disclose whether the email is real.
      return NextResponse.json(apiSuccess({ ok: true }));
    }

    const token = crypto.randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);

    await db.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = appUrl(`/reset-password/${token}`);
    const { subject, html, text } = staffPasswordResetEmail({
      recipientName: user.name,
      resetUrl,
      expiresAt,
    });

    await sendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [{ name: "kind", value: "staff-password-reset" }],
    });

    const ip = req.headers.get("x-forwarded-for");
    await writeAudit({
      actorUserId: user.id,
      actorType: "staff",
      action: "staff.password_reset.requested",
      entityType: "user",
      entityId: user.id,
      metadata: ip ? { ip } : {},
    });

    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
