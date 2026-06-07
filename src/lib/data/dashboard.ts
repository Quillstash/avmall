/**
 * Single aggregator for the admin dashboard. Runs all the DB queries the
 * dashboard needs in parallel so the page renders in one round-trip.
 *
 * Falls back to zeros / empty arrays when DATABASE_URL isn't set so the
 * admin page still renders in design mode.
 */

import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";
import { listAdminOrders, type OrderListRow } from "@/lib/data/orders";

export interface DashboardKpi {
  revenueKobo: number;
  /** % change vs yesterday. Null when yesterday had no orders. */
  revenueDeltaPct: number | null;
  orderCount: number;
  /** Absolute delta vs yesterday's order count. */
  orderDelta: number | null;
  aovKobo: number;
  outstandingKobo: number;
  partiallyPaidCount: number;
  awaitingConfirm: number;
}

export interface DashboardData {
  todayLabel: string;
  kpi: DashboardKpi;
  queue: {
    awaitingConfirm: number;
    partiallyPaid: number;
    partiallyPaidOutstandingKobo: number;
    returnsPending: number;
    lowStock: number;
    aiHandoffs: number;
  };
  /** Last 30 days, one entry per day, oldest first. */
  revenueSeries: { date: string; revenueKobo: number }[];
  ordersByStatus: { status: string; count: number }[];
  recentOrders: OrderListRow[];
}

/** Start of "today" in Africa/Lagos (UTC+1, no DST), as a UTC Date. */
function startOfLagosDay(daysAgo = 0): Date {
  // Build the Lagos calendar date for `now - daysAgo days`.
  const ref = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref);
  const lookup = (t: string) => parts.find((p) => p.type === t)?.value ?? "01";
  // Lagos is fixed UTC+1 — midnight Lagos = 23:00 the previous UTC day.
  return new Date(
    `${lookup("year")}-${lookup("month")}-${lookup("day")}T00:00:00+01:00`,
  );
}

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

const EMPTY: DashboardData = {
  todayLabel: new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date()),
  kpi: {
    revenueKobo: 0,
    revenueDeltaPct: null,
    orderCount: 0,
    orderDelta: null,
    aovKobo: 0,
    outstandingKobo: 0,
    partiallyPaidCount: 0,
    awaitingConfirm: 0,
  },
  queue: {
    awaitingConfirm: 0,
    partiallyPaid: 0,
    partiallyPaidOutstandingKobo: 0,
    returnsPending: 0,
    lowStock: 0,
    aiHandoffs: 0,
  },
  revenueSeries: [],
  ordersByStatus: [],
  recentOrders: [],
};

export async function getDashboard(): Promise<DashboardData> {
  if (!hasDatabase) return EMPTY;

  const todayStart = startOfLagosDay(0);
  const yesterdayStart = startOfLagosDay(1);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = startOfLagosDay(30);

  const [
    todayOrders,
    yesterdayOrders,
    outstandingRows,
    awaitingConfirmCount,
    returnsPendingCount,
    lowStockCount,
    aiHandoffsCount,
    revenueByDayRows,
    statusGroupRows,
    recent,
  ] = await Promise.all([
    withRetry(() =>
      db.order.findMany({
        where: {
          createdAt: { gte: todayStart, lt: todayEnd },
          status: { notIn: ["cancelled"] },
        },
        select: { totalKobo: true },
      }),
    ),
    withRetry(() =>
      db.order.findMany({
        where: {
          createdAt: { gte: yesterdayStart, lt: todayStart },
          status: { notIn: ["cancelled"] },
        },
        select: { totalKobo: true },
      }),
    ),
    withRetry(() =>
      db.order.findMany({
        where: { paymentStatus: "partial" },
        select: { totalKobo: true, paidKobo: true },
      }),
    ),
    withRetry(() => db.order.count({ where: { status: "pending" } })),
    withRetry(() =>
      db.return.count({
        where: { status: { in: ["requested", "approved", "in_transit"] } },
      }),
    ),
    // Low stock = a product whose total on-hand (across variants) is ≤ 5.
    // Approximated as the count of products that have ANY variant with
    // onHand ≤ 5 and isn't archived/unpublished.
    withRetry(() =>
      db.product.count({
        where: {
          archivedAt: null,
          published: true,
          variants: { some: { storeStock: { some: { onHand: { lte: 5 } } } } },
        },
      }),
    ),
    withRetry(() =>
      db.aiConversation.count({
        where: { status: "handoff_pending" },
      }),
    ),
    // Revenue grouped by Lagos day. Easiest path: pull totalKobo + createdAt
    // for the window and bucket in JS. The window is bounded to 30 × ~few
    // hundred = manageable in memory.
    withRetry(() =>
      db.order.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: { notIn: ["cancelled"] },
        },
        select: { totalKobo: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ),
    withRetry(() =>
      db.order.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ),
    listAdminOrders(),
  ]);

  const todayRevenueKobo = todayOrders.reduce(
    (a, o) => a + Number(o.totalKobo),
    0,
  );
  const yesterdayRevenueKobo = yesterdayOrders.reduce(
    (a, o) => a + Number(o.totalKobo),
    0,
  );
  const todayOrderCount = todayOrders.length;
  const aovKobo = todayOrderCount > 0 ? Math.round(todayRevenueKobo / todayOrderCount) : 0;

  const partiallyPaidOutstandingKobo = outstandingRows.reduce(
    (a, o) => a + (Number(o.totalKobo) - Number(o.paidKobo)),
    0,
  );

  // Build 30-day series with zero-fill for empty days.
  const seriesMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = startOfLagosDay(i);
    const key = d.toISOString().slice(0, 10);
    seriesMap.set(key, 0);
  }
  for (const o of revenueByDayRows) {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(o.createdAt);
    if (seriesMap.has(key)) {
      seriesMap.set(key, seriesMap.get(key)! + Number(o.totalKobo));
    }
  }

  return {
    todayLabel: new Intl.DateTimeFormat("en-NG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Lagos",
    }).format(new Date()),
    kpi: {
      revenueKobo: todayRevenueKobo,
      revenueDeltaPct: pct(todayRevenueKobo, yesterdayRevenueKobo),
      orderCount: todayOrderCount,
      orderDelta:
        yesterdayOrders.length === 0 ? null : todayOrderCount - yesterdayOrders.length,
      aovKobo,
      outstandingKobo: partiallyPaidOutstandingKobo,
      partiallyPaidCount: outstandingRows.length,
      awaitingConfirm: awaitingConfirmCount,
    },
    queue: {
      awaitingConfirm: awaitingConfirmCount,
      partiallyPaid: outstandingRows.length,
      partiallyPaidOutstandingKobo,
      returnsPending: returnsPendingCount,
      lowStock: lowStockCount,
      aiHandoffs: aiHandoffsCount,
    },
    revenueSeries: Array.from(seriesMap.entries()).map(([date, revenueKobo]) => ({
      date,
      revenueKobo,
    })),
    ordersByStatus: statusGroupRows.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    recentOrders: recent.slice(0, 6),
  };
}
