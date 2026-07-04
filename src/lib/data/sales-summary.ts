/**
 * Whole-business sales summary for a rolling period (daily / weekly / monthly),
 * used by the recurring summary emails. Reports combined totals plus per-store,
 * per-channel and top-product breakdowns, and a delta against the previous
 * equivalent window.
 *
 * Windows are computed in West Africa Time. Nigeria observes a FIXED UTC+1 with
 * no daylight saving — ever — so a constant +1h offset is exact for all dates
 * (used only for boundary math; display labels go through Intl/Africa/Lagos).
 */
import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";
import { ORDER_SOURCE_LABELS } from "@/lib/order-source";

export type SummaryPeriod = "daily" | "weekly" | "monthly";

export interface SalesSummary {
  period: SummaryPeriod;
  periodLabel: string;
  from: string;
  to: string;
  ordersCount: number;
  unitsSold: number;
  grossSalesKobo: number;
  collectedKobo: number;
  outstandingKobo: number;
  newCustomers: number;
  /** Previous equivalent window, for the trend line. */
  prev: { grossSalesKobo: number; ordersCount: number };
  byStore: { store: string; ordersCount: number; grossSalesKobo: number }[];
  byChannel: { channel: string; label: string; ordersCount: number; grossSalesKobo: number }[];
  topProducts: { name: string; units: number; revenueKobo: number }[];
}

const DAY = 86_400_000;
const WAT = 60 * 60 * 1000; // Nigeria = UTC+1, no DST.

function watParts(d: Date) {
  const w = new Date(d.getTime() + WAT);
  return { y: w.getUTCFullYear(), m: w.getUTCMonth(), day: w.getUTCDate(), weekday: w.getUTCDay() };
}
/** UTC instant of 00:00 WAT on the WAT-calendar day containing `d`. */
function watMidnight(d: Date): Date {
  const { y, m, day } = watParts(d);
  return new Date(Date.UTC(y, m, day, 0, 0, 0) - WAT);
}
/** UTC instant of 00:00 WAT on the 1st of the WAT month, `offsetMonths` away. */
function watMonthStart(d: Date, offsetMonths: number): Date {
  const { y, m } = watParts(d);
  return new Date(Date.UTC(y, m + offsetMonths, 1, 0, 0, 0) - WAT);
}

const monthFmt = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric", timeZone: "Africa/Lagos" });
const dayFmt = new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
const rangeFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

interface Win { from: Date; to: Date; prevFrom: Date; prevTo: Date; label: string }

function windowFor(period: SummaryPeriod, asOf: Date): Win {
  if (period === "monthly") {
    const to = watMonthStart(asOf, 0); // 1st of current month
    const from = watMonthStart(asOf, -1); // 1st of previous month
    const prevFrom = watMonthStart(asOf, -2);
    return { from, to, prevFrom, prevTo: from, label: monthFmt.format(from) };
  }
  const today = watMidnight(asOf);
  const span = period === "weekly" ? 7 * DAY : DAY;
  const to = today;
  const from = new Date(to.getTime() - span);
  const prevTo = from;
  const prevFrom = new Date(from.getTime() - span);
  const label =
    period === "daily"
      ? dayFmt.format(from)
      : `${rangeFmt.format(from)} – ${rangeFmt.format(new Date(to.getTime() - DAY))}`;
  return { from, to, prevFrom, prevTo, label };
}

/** Which summaries are "due" on the given day: daily always; weekly on Monday;
 *  monthly on the 1st (WAT). Lets one daily cron fire all three. */
export function periodsDue(asOf: Date): SummaryPeriod[] {
  const { day, weekday } = watParts(asOf);
  const due: SummaryPeriod[] = ["daily"];
  if (weekday === 1) due.push("weekly"); // Monday → last week
  if (day === 1) due.push("monthly"); // 1st → last month
  return due;
}

const EMPTY = (period: SummaryPeriod, w: Win): SalesSummary => ({
  period, periodLabel: w.label, from: w.from.toISOString(), to: w.to.toISOString(),
  ordersCount: 0, unitsSold: 0, grossSalesKobo: 0, collectedKobo: 0, outstandingKobo: 0,
  newCustomers: 0, prev: { grossSalesKobo: 0, ordersCount: 0 }, byStore: [], byChannel: [], topProducts: [],
});

export async function getSalesSummary(period: SummaryPeriod, asOf: Date = new Date()): Promise<SalesSummary> {
  const w = windowFor(period, asOf);
  if (!hasDatabase) return EMPTY(period, w);

  const notCancelled = { status: { not: "cancelled" as const } };

  const [orders, prevAgg, newCustomers] = await Promise.all([
    withRetry(() =>
      db.order.findMany({
        where: { ...notCancelled, createdAt: { gte: w.from, lt: w.to } },
        select: {
          totalKobo: true, paidKobo: true, source: true,
          store: { select: { name: true } },
          lines: { select: { quantity: true, unitKobo: true, bulkDiscountKobo: true, nameSnapshot: true } },
        },
      }),
    ),
    withRetry(() =>
      db.order.aggregate({
        _count: { _all: true }, _sum: { totalKobo: true },
        where: { ...notCancelled, createdAt: { gte: w.prevFrom, lt: w.prevTo } },
      }),
    ),
    withRetry(() => db.customer.count({ where: { createdAt: { gte: w.from, lt: w.to } } })),
  ]);

  let grossSalesKobo = 0, collectedKobo = 0, unitsSold = 0;
  const storeMap = new Map<string, { ordersCount: number; grossSalesKobo: number }>();
  const chanMap = new Map<string, { ordersCount: number; grossSalesKobo: number }>();
  const prodMap = new Map<string, { units: number; revenueKobo: number }>();

  for (const o of orders) {
    const total = Number(o.totalKobo);
    grossSalesKobo += total;
    collectedKobo += Number(o.paidKobo);

    const storeName = o.store?.name ?? "—";
    const s = storeMap.get(storeName) ?? { ordersCount: 0, grossSalesKobo: 0 };
    s.ordersCount += 1; s.grossSalesKobo += total; storeMap.set(storeName, s);

    const c = chanMap.get(o.source) ?? { ordersCount: 0, grossSalesKobo: 0 };
    c.ordersCount += 1; c.grossSalesKobo += total; chanMap.set(o.source, c);

    for (const l of o.lines) {
      unitsSold += l.quantity;
      const rev = Number(l.unitKobo) * l.quantity - Number(l.bulkDiscountKobo);
      const p = prodMap.get(l.nameSnapshot) ?? { units: 0, revenueKobo: 0 };
      p.units += l.quantity; p.revenueKobo += rev; prodMap.set(l.nameSnapshot, p);
    }
  }

  return {
    period,
    periodLabel: w.label,
    from: w.from.toISOString(),
    to: w.to.toISOString(),
    ordersCount: orders.length,
    unitsSold,
    grossSalesKobo,
    collectedKobo,
    outstandingKobo: Math.max(0, grossSalesKobo - collectedKobo),
    newCustomers,
    prev: {
      grossSalesKobo: Number(prevAgg._sum.totalKobo ?? 0),
      ordersCount: prevAgg._count._all,
    },
    byStore: [...storeMap.entries()]
      .map(([store, v]) => ({ store, ...v }))
      .sort((a, b) => b.grossSalesKobo - a.grossSalesKobo),
    byChannel: [...chanMap.entries()]
      .map(([channel, v]) => ({
        channel,
        label: ORDER_SOURCE_LABELS[channel as keyof typeof ORDER_SOURCE_LABELS] ?? channel,
        ...v,
      }))
      .sort((a, b) => b.grossSalesKobo - a.grossSalesKobo),
    topProducts: [...prodMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenueKobo - a.revenueKobo)
      .slice(0, 8),
  };
}
