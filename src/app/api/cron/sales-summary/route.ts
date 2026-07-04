/**
 * GET /api/cron/sales-summary
 *
 * Emails the sales summary to managers / super-admins. Wire it to an external
 * scheduler (GitHub Actions / cron-job.org / Vercel Cron) to run ONCE DAILY,
 * ideally early morning WAT — it self-selects what to send:
 *   • daily   — every run (covers the previous day)
 *   • weekly  — additionally on Mondays (covers the previous 7 days)
 *   • monthly — additionally on the 1st (covers the previous calendar month)
 *
 * Force a specific one with `?period=daily|weekly|monthly` (handy for testing
 * or a manual re-send). `?period=all` sends all three regardless of the day.
 *
 * Auth: Bearer CRON_SECRET. Returns 503 when CRON_SECRET isn't configured.
 */

import { NextRequest, NextResponse } from "next/server";
import { emailSalesSummary } from "@/lib/sales-summary-email";
import { periodsDue, type SummaryPeriod } from "@/lib/data/sales-summary";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

const ALL: SummaryPeriod[] = ["daily", "weekly", "monthly"];

export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: { code: "CRON_NOT_CONFIGURED", message: "CRON_SECRET not set" } },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const presented = header.toLowerCase().startsWith("bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";
  if (!safeEqual(presented, env.CRON_SECRET)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Invalid cron token" } },
      { status: 403 },
    );
  }

  const requested = req.nextUrl.searchParams.get("period");
  const now = new Date();

  let periods: SummaryPeriod[];
  if (requested === "all") {
    periods = ALL;
  } else if (requested && (ALL as string[]).includes(requested)) {
    periods = [requested as SummaryPeriod];
  } else {
    periods = periodsDue(now);
  }

  // Sequential — a handful of emails, keeps Resend well under any rate limit.
  const results = [];
  for (const p of periods) {
    results.push(await emailSalesSummary(p, now));
  }

  return NextResponse.json({
    data: { at: now.toISOString(), sent: results },
  });
}

export const POST = GET;
