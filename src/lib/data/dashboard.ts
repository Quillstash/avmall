/**
 * Single aggregator for the admin dashboard. Runs all the DB queries the
 * dashboard needs in parallel so the page renders in one round-trip.
 *
 * Falls back to zeros / empty arrays when DATABASE_URL isn't set so the
 * admin page still renders in design mode.
 */

import "server-only";

import { Prisma } from "@prisma/client";
import { db, hasDatabase, withRetry } from "@/lib/db";
import { listAdminOrders, type OrderListRow } from "@/lib/data/orders";
import { ORDER_SOURCE_LABELS } from "@/lib/order-source";

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

/** Canonical order-status order for the "Orders by status" breakdown — every
 *  status is shown (zero-filled) so the legend is always complete. */
const ALL_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export async function getDashboard(
  statusRange?: { from: Date; to: Date } | number,
  storeId?: string | null,
): Promise<DashboardData> {
  if (!hasDatabase) return EMPTY;

  // Scope every metric to the admin's active store.
  const storeFilter = storeId ? { storeId } : {};

  const todayStart = startOfLagosDay(0);
  const yesterdayStart = startOfLagosDay(1);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = startOfLagosDay(30);

  // The "Orders by status" breakdown is scoped to the dashboard's selected
  // timeframe (same control as the revenue chart). A number = last N days.
  const statusWindow =
    typeof statusRange === "number"
      ? { from: startOfLagosDay(statusRange), to: todayEnd }
      : (statusRange ?? null);

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
          ...storeFilter,
          createdAt: { gte: todayStart, lt: todayEnd },
          status: { notIn: ["cancelled"] },
        },
        select: { totalKobo: true },
      }),
    ),
    withRetry(() =>
      db.order.findMany({
        where: {
          ...storeFilter,
          createdAt: { gte: yesterdayStart, lt: todayStart },
          status: { notIn: ["cancelled"] },
        },
        select: { totalKobo: true },
      }),
    ),
    withRetry(() =>
      db.order.findMany({
        where: { ...storeFilter, paymentStatus: "partial" },
        select: { totalKobo: true, paidKobo: true },
      }),
    ),
    withRetry(() => db.order.count({ where: { ...storeFilter, status: "pending" } })),
    withRetry(() =>
      db.return.count({
        where: {
          status: { in: ["requested", "approved", "in_transit"] },
          ...(storeId ? { order: { storeId } } : {}),
        },
      }),
    ),
    // Low stock = a product (in this store) with any variant at ≤ 5 on-hand.
    withRetry(() =>
      db.product.count({
        where: {
          ...storeFilter,
          archivedAt: null,
          published: true,
          variants: {
            some: {
              storeStock: {
                some: { onHand: { lte: 5 }, ...(storeId ? { storeId } : {}) },
              },
            },
          },
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
          ...storeFilter,
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
        ...(statusWindow || storeId
          ? {
              where: {
                ...storeFilter,
                ...(statusWindow
                  ? { createdAt: { gte: statusWindow.from, lt: statusWindow.to } }
                  : {}),
              },
            }
          : {}),
      }),
    ),
    listAdminOrders(storeId),
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
    ordersByStatus: ALL_ORDER_STATUSES.map((status) => ({
      status,
      count: statusGroupRows.find((r) => r.status === status)?._count._all ?? 0,
    })),
    recentOrders: recent.slice(0, 6),
  };
}

// ─── Business Overview (Bumpa-style) ────────────────────────────────────────

export interface ChannelStat {
  source: string;
  label: string;
  count: number;
  revenueKobo: number;
}

export interface BusinessOverview {
  ordersCount: number;
  productsSold: number;
  newCustomers: number;
  totalSalesKobo: number;
  /** Amount actually collected (sum of paidKobo). */
  settledKobo: number;
  /** Outstanding balance across the range (total − paid). */
  owedKobo: number;
  /** Sales from walk-in + phone orders. */
  offlineSalesKobo: number;
  onlineSalesKobo: number;
  monthly: { label: string; onlineKobo: number; offlineKobo: number }[];
  channels: ChannelStat[];
  /** ISO timestamp when the money figures were last synced from Bumpa's
   *  analytics API. Set only when a cached Bumpa snapshot supplied them. */
  syncedAt?: string;
}

/** Online = the self-service website only; everything else (walk-in, WhatsApp,
 *  phone, AI) counts as offline — matches how Bumpa splits online vs offline. */
const ONLINE_SOURCES = new Set(["web"]);
const SOURCE_LABELS: Record<string, string> = ORDER_SOURCE_LABELS;

const EMPTY_OVERVIEW: BusinessOverview = {
  ordersCount: 0,
  productsSold: 0,
  newCustomers: 0,
  totalSalesKobo: 0,
  settledKobo: 0,
  owedKobo: 0,
  offlineSalesKobo: 0,
  onlineSalesKobo: 0,
  monthly: [],
  channels: [],
};

export async function getBusinessOverview(
  range: { from: Date; to: Date } | number,
  storeId?: string | null,
): Promise<BusinessOverview> {
  if (!hasDatabase) return EMPTY_OVERVIEW;
  const storeFilter = storeId ? { storeId } : {};
  const win =
    typeof range === "number"
      ? { from: startOfLagosDay(range), to: new Date() }
      : range;

  const orderWhere: Prisma.OrderWhereInput = {
    ...storeFilter,
    createdAt: { gte: win.from, lt: win.to },
    status: { notIn: ["cancelled"] },
  };

  const [orders, soldAgg, newCustomers] = await Promise.all([
    withRetry(() =>
      db.order.findMany({
        where: orderWhere,
        select: { totalKobo: true, paidKobo: true, source: true, createdAt: true },
      }),
    ),
    withRetry(() =>
      db.orderLine.aggregate({ _sum: { quantity: true }, where: { order: orderWhere } }),
    ),
    withRetry(() =>
      db.customer.count({ where: { createdAt: { gte: win.from, lt: win.to } } }),
    ),
  ]);

  const monthKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
  });
  const monthLabel = new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    month: "short",
  });

  // Pre-seed every month spanned by the window so the bar chart shows empty
  // months too (Jan…Dec for a full-year range).
  const monthly = new Map<string, { label: string; onlineKobo: number; offlineKobo: number }>();
  let cursor = new Date(Date.UTC(win.from.getUTCFullYear(), win.from.getUTCMonth(), 1));
  for (let guard = 0; cursor < win.to && guard < 36; guard++) {
    monthly.set(monthKey.format(cursor), {
      label: monthLabel.format(cursor),
      onlineKobo: 0,
      offlineKobo: 0,
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  let totalSalesKobo = 0,
    settledKobo = 0,
    owedKobo = 0,
    offlineSalesKobo = 0;
  const channelMap = new Map<string, { count: number; revenueKobo: number }>();

  for (const o of orders) {
    const total = Number(o.totalKobo);
    const paid = Number(o.paidKobo);
    totalSalesKobo += total;
    settledKobo += paid;
    owedKobo += Math.max(0, total - paid);
    const offline = !ONLINE_SOURCES.has(o.source);
    if (offline) offlineSalesKobo += total;

    const c = channelMap.get(o.source) ?? { count: 0, revenueKobo: 0 };
    c.count += 1;
    c.revenueKobo += total;
    channelMap.set(o.source, c);

    const m = monthly.get(monthKey.format(o.createdAt));
    if (m) {
      if (offline) m.offlineKobo += total;
      else m.onlineKobo += total;
    }
  }

  const channels = Array.from(channelMap.entries())
    .map(([source, v]) => ({ source, label: SOURCE_LABELS[source] ?? source, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Prefer Bumpa's authoritative money figures when a cached snapshot for this
  // period exists — so the dashboard headline matches Bumpa to the kobo. Wrapped
  // in try/catch so it degrades to the computed figures before the snapshot
  // table/migration exists.
  let totalOut = totalSalesKobo, offlineOut = offlineSalesKobo, settledOut = settledKobo, owedOut = owedKobo;
  let syncedAt: string | undefined;
  if (storeId) {
    try {
      const periodKey = String(win.from.getUTCFullYear());
      const snap = await db.bumpaSalesSnapshot.findUnique({
        where: { storeId_periodKey: { storeId, periodKey } },
      });
      if (snap) {
        totalOut = Number(snap.totalSalesKobo);
        offlineOut = Number(snap.offlineSalesKobo);
        settledOut = Number(snap.settledKobo);
        owedOut = Number(snap.owedKobo);
        syncedAt = snap.fetchedAt.toISOString();
      }
    } catch {
      /* snapshot table not migrated yet — use computed figures */
    }
  }

  return {
    ordersCount: orders.length,
    productsSold: soldAgg._sum?.quantity ?? 0,
    newCustomers,
    totalSalesKobo: totalOut,
    settledKobo: settledOut,
    owedKobo: owedOut,
    offlineSalesKobo: offlineOut,
    onlineSalesKobo: totalOut - offlineOut,
    monthly: Array.from(monthly.values()),
    channels,
    ...(syncedAt && { syncedAt }),
  };
}
