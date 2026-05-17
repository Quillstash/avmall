/**
 * GET /api/cron/expire-reservations
 *
 * Sweeps expired stock reservations (releases the held inventory). Schedule
 * this every 1–2 minutes from your cron of choice:
 *
 *   Vercel Cron:    add { path: "/api/cron/expire-reservations" } to vercel.json
 *   GitHub Actions: curl with Authorization: Bearer $CRON_SECRET
 *   External cron:  https://app.cron-job.org/ etc.
 *
 * Auth: Bearer CRON_SECRET (set in env). When CRON_SECRET isn't configured the
 * route returns 503 — refuse to run rather than be anonymously triggerable.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { expireOldReservations } from "@/lib/stock";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
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
    return NextResponse.json({ data: { swept: 0, db: "missing" } });
  }

  const swept = await db.$transaction(async (tx) => {
    return expireOldReservations(tx);
  });

  return NextResponse.json({ data: { swept, at: new Date().toISOString() } });
}

// Some cron providers POST. Accept both.
export const POST = GET;
