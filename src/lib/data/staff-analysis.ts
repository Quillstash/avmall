/**
 * Per-staff activity summary for a date range: goods sold (orders they created),
 * payments they recorded, returns they handled, expenses they logged, and their
 * total audit-log activity with a top-actions breakdown.
 *
 * Web/self-checkout orders have no creator, so "goods sold by staff" reflects
 * POS + manually-created orders. Returns aren't attributed to a processor on the
 * Return row, so return activity is read from the audit log (action `return.*`).
 */
import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";

export interface StaffStat {
  id: string;
  name: string;
  role: string;
  active: boolean;
  ordersCreated: number;
  salesKobo: number;
  unitsSold: number;
  paymentsRecorded: number;
  paymentsKobo: number;
  returnsHandled: number;
  activityCount: number;
  topActions: { action: string; count: number }[];
  expensesLogged: number;
  expensesKobo: number;
}

export interface StaffAnalysis {
  from: string;
  to: string;
  staff: StaffStat[];
  totals: { ordersCreated: number; salesKobo: number; unitsSold: number; paymentsKobo: number; activityCount: number };
}

const DAY = 86_400_000;
const EMPTY: StaffAnalysis = { from: "", to: "", staff: [], totals: { ordersCreated: 0, salesKobo: 0, unitsSold: 0, paymentsKobo: 0, activityCount: 0 } };

export async function getStaffAnalysis(
  range: { from: Date; to: Date } | number = 30,
  storeId?: string | null,
): Promise<StaffAnalysis> {
  if (!hasDatabase) return EMPTY;
  const now = new Date();
  const to = typeof range === "number" ? now : range.from <= range.to ? range.to : range.from;
  const from =
    typeof range === "number"
      ? new Date(now.getTime() - (Math.max(1, range) - 1) * DAY)
      : range.from <= range.to ? range.from : range.to;

  const storeFilter = storeId ? { storeId } : {};

  const [users, orders, payments, audits, expenses] = await Promise.all([
    withRetry(() => db.user.findMany({ select: { id: true, name: true, role: true, active: true } })),
    withRetry(() =>
      db.order.findMany({
        where: { ...storeFilter, createdById: { not: null }, createdAt: { gte: from, lt: to }, status: { notIn: ["cancelled" as const] } },
        select: { createdById: true, totalKobo: true, lines: { select: { quantity: true } } },
      }),
    ),
    withRetry(() =>
      db.orderPayment.groupBy({ by: ["recordedById"], _count: { _all: true }, _sum: { amountKobo: true }, where: { recordedById: { not: null }, createdAt: { gte: from, lt: to } } }),
    ),
    withRetry(() =>
      db.auditLog.groupBy({ by: ["actorUserId", "action"], _count: { _all: true }, where: { actorUserId: { not: null }, actorType: "staff", createdAt: { gte: from, lt: to } } }),
    ),
    withRetry(() =>
      db.expense.groupBy({ by: ["createdById"], _count: { _all: true }, _sum: { amountKobo: true }, where: { ...storeFilter, createdById: { not: null }, date: { gte: from, lt: to } } }),
    ),
  ]);

  const ordAgg = new Map<string, { count: number; sales: number; units: number }>();
  for (const o of orders) {
    const id = o.createdById!;
    const a = ordAgg.get(id) ?? { count: 0, sales: 0, units: 0 };
    a.count += 1;
    a.sales += Number(o.totalKobo);
    a.units += o.lines.reduce((s, l) => s + l.quantity, 0);
    ordAgg.set(id, a);
  }

  const payAgg = new Map(payments.map((p) => [p.recordedById!, { count: p._count._all, amount: Number(p._sum.amountKobo ?? 0) }]));
  const expAgg = new Map(expenses.map((e) => [e.createdById!, { count: e._count._all, amount: Number(e._sum.amountKobo ?? 0) }]));

  const auditAgg = new Map<string, { total: number; actions: Map<string, number>; returns: number }>();
  for (const r of audits) {
    const id = r.actorUserId!;
    const a = auditAgg.get(id) ?? { total: 0, actions: new Map<string, number>(), returns: 0 };
    a.total += r._count._all;
    a.actions.set(r.action, (a.actions.get(r.action) ?? 0) + r._count._all);
    if (r.action.startsWith("return")) a.returns += r._count._all;
    auditAgg.set(id, a);
  }

  const staff: StaffStat[] = users
    .map((u) => {
      const o = ordAgg.get(u.id);
      const p = payAgg.get(u.id);
      const au = auditAgg.get(u.id);
      const ex = expAgg.get(u.id);
      const topActions = au
        ? [...au.actions.entries()].map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count).slice(0, 5)
        : [];
      return {
        id: u.id,
        name: u.name,
        role: String(u.role),
        active: u.active,
        ordersCreated: o?.count ?? 0,
        salesKobo: o?.sales ?? 0,
        unitsSold: o?.units ?? 0,
        paymentsRecorded: p?.count ?? 0,
        paymentsKobo: p?.amount ?? 0,
        returnsHandled: au?.returns ?? 0,
        activityCount: au?.total ?? 0,
        topActions,
        expensesLogged: ex?.count ?? 0,
        expensesKobo: ex?.amount ?? 0,
      };
    })
    // Everyone who did something first, then the rest, best sellers on top.
    .sort((a, b) => b.salesKobo - a.salesKobo || b.activityCount - a.activityCount || a.name.localeCompare(b.name));

  const totals = staff.reduce(
    (t, s) => ({
      ordersCreated: t.ordersCreated + s.ordersCreated,
      salesKobo: t.salesKobo + s.salesKobo,
      unitsSold: t.unitsSold + s.unitsSold,
      paymentsKobo: t.paymentsKobo + s.paymentsKobo,
      activityCount: t.activityCount + s.activityCount,
    }),
    { ordersCreated: 0, salesKobo: 0, unitsSold: 0, paymentsKobo: 0, activityCount: 0 },
  );

  return { from: from.toISOString(), to: to.toISOString(), staff, totals };
}
