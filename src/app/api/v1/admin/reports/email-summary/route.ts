/**
 * POST /api/v1/admin/reports/email-summary
 *
 * Sends the caller a PREVIEW of the sales-summary email for a period, so staff
 * can see what the scheduled email looks like without waiting for (or spamming)
 * the whole management team. The real recurring send goes to every active
 * manager / super-admin via /api/cron/sales-summary.
 *
 * Body: { period: "daily" | "weekly" | "monthly" }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { emailSalesSummary } from "@/lib/sales-summary-email";
import { emailConfigured } from "@/lib/email";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z.object({
  period: z.enum(["daily", "weekly", "monthly"]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "reports.view");

    if (!emailConfigured) {
      throw new AppError("EMAIL_NOT_CONFIGURED", "Email isn't set up (RESEND_API_KEY).", 503);
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError({ period: "Pick daily, weekly or monthly" });

    const result = await emailSalesSummary(parsed.data.period, new Date(), {
      to: [session.email],
    });

    if (!result.sent) {
      throw new AppError("SUMMARY_NOT_SENT", result.reason ?? "Could not send the summary", 502);
    }

    return NextResponse.json(
      apiSuccess({ sentTo: session.email, period: result.period, ordersCount: result.ordersCount }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
