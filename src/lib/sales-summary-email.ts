/**
 * Builds and sends the recurring sales-summary email for a period. Recipients
 * default to every active manager / super-admin (so new managers are looped in
 * automatically); `SALES_SUMMARY_RECIPIENTS` overrides with an explicit list.
 *
 * Fire-and-forget like the rest of our email: never throws into the caller.
 */
import "server-only";

import { db, hasDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail, emailConfigured } from "@/lib/email";
import { salesSummaryEmail } from "@/lib/email-templates";
import { getSalesSummary, type SummaryPeriod } from "@/lib/data/sales-summary";
import { appUrl } from "@/lib/app-url";

export interface SummarySendResult {
  period: SummaryPeriod;
  sent: boolean;
  recipients: number;
  grossSalesKobo: number;
  ordersCount: number;
  reason?: string;
}

/** Active managers + super-admins, or the env override list. Deduped. */
async function resolveRecipients(): Promise<string[]> {
  const override = env.SALES_SUMMARY_RECIPIENTS;
  if (override) {
    const list = override
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));
    return [...new Set(list)];
  }
  if (!hasDatabase) return [];
  const staff = await db.user.findMany({
    where: { active: true, role: { in: ["manager", "super_admin"] } },
    select: { email: true },
  });
  return [...new Set(staff.map((s) => s.email).filter((e): e is string => !!e && e.includes("@")))];
}

export async function emailSalesSummary(
  period: SummaryPeriod,
  asOf: Date = new Date(),
  opts?: { to?: string[] },
): Promise<SummarySendResult> {
  const summary = await getSalesSummary(period, asOf);
  const base: SummarySendResult = {
    period,
    sent: false,
    recipients: 0,
    grossSalesKobo: summary.grossSalesKobo,
    ordersCount: summary.ordersCount,
  };

  if (!emailConfigured) return { ...base, reason: "email-not-configured" };

  // An explicit `to` (used by the "send me a preview" button) skips the
  // manager lookup so a test doesn't email the whole team.
  const recipients =
    opts?.to && opts.to.length > 0
      ? [...new Set(opts.to.filter((e) => e.includes("@")))]
      : await resolveRecipients();
  if (recipients.length === 0) return { ...base, reason: "no-recipients" };

  const content = salesSummaryEmail({ summary, dashboardUrl: appUrl("/admin") });
  const res = await sendEmail({
    to: recipients,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [{ name: "type", value: `sales-summary-${period}` }],
  });

  return {
    ...base,
    sent: res.ok,
    recipients: recipients.length,
    ...(res.error && { reason: res.error }),
  };
}
