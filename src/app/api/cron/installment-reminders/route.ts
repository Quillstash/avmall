/**
 * GET /api/cron/installment-reminders
 *
 * Sweeps active installment plans with an outstanding balance and emails a
 * reminder, throttled to once a week per plan (lastReminderAt). Wire it to an
 * external scheduler (GitHub Actions / cron-job.org / Vercel Cron) daily.
 *
 * Auth: Bearer CRON_SECRET. Returns 503 when CRON_SECRET isn't configured.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { emailInstallmentReminder } from "@/lib/order-emails";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const CADENCE_MS = 7 * 24 * 60 * 60 * 1000;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

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

  if (!hasDatabase) {
    return NextResponse.json({ data: { reminded: 0, db: "missing" } });
  }

  const threshold = new Date(Date.now() - CADENCE_MS);

  const due = await db.installmentPlan.findMany({
    where: {
      status: "active",
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: threshold } }],
    },
    include: { order: { select: { id: true, totalKobo: true, paidKobo: true } } },
    take: 200,
  });

  let reminded = 0;
  for (const plan of due) {
    // Prisma can't compare two columns in `where`, so filter the balance here.
    if (plan.order.paidKobo >= plan.order.totalKobo) continue;
    const emailed = await emailInstallmentReminder(plan.order.id);
    await db.installmentPlan.update({
      where: { id: plan.id },
      data: { lastReminderAt: new Date() },
    });
    if (emailed) reminded++;
  }

  return NextResponse.json({
    data: { processed: due.length, reminded, at: new Date().toISOString() },
  });
}

export const POST = GET;
