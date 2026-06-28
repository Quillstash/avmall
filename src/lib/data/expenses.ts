/**
 * Expenses data layer. Reads expense types + expense rows for a store, and a
 * period P&L summary (gross profit − expenses = net profit) for the Expenses
 * tab. Writes live in the API routes.
 */

import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";

export interface ExpenseTypeView {
  id: string;
  name: string;
}

export interface ExpenseRow {
  id: string;
  typeId: string;
  typeName: string;
  amountKobo: number;
  /** Display date in WAT, e.g. "5 Jun 2026". */
  dateLabel: string;
  /** ISO date (yyyy-mm-dd) for any client-side logic. */
  dateISO: string;
  note: string | null;
  by: string;
}

export interface ExpenseSummary {
  /** Goods revenue (line totals after bulk discounts) for non-cancelled orders. */
  revenueKobo: number;
  /** Cost of goods sold (qty × current product cost). */
  cogsKobo: number;
  /** revenue − COGS. */
  grossProfitKobo: number;
  /** Total expenses recorded in the period. */
  expensesKobo: number;
  /** grossProfit − expenses. */
  netProfitKobo: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

function lagosDateLabel(d: Date): string {
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

/** Active (non-archived) expense types for a store, alphabetical. */
export async function listExpenseTypes(
  storeId: string | null,
): Promise<ExpenseTypeView[]> {
  if (!hasDatabase || !storeId) return [];
  const rows = await withRetry(() =>
    db.expenseType.findMany({
      where: { storeId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  );
  return rows;
}

/** Expenses for a store within a date range, newest first. */
export async function listExpenses(
  storeId: string | null,
  range: DateRange,
): Promise<ExpenseRow[]> {
  if (!hasDatabase || !storeId) return [];
  const rows = await withRetry(() =>
    db.expense.findMany({
      where: { storeId, date: { gte: range.from, lte: range.to } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        type: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
  );
  return rows.map((e) => ({
    id: e.id,
    typeId: e.typeId,
    typeName: e.type.name,
    amountKobo: Number(e.amountKobo),
    dateLabel: lagosDateLabel(e.date),
    dateISO: e.date.toISOString().slice(0, 10),
    note: e.note,
    by: e.createdBy?.name ?? "—",
  }));
}

/**
 * Period P&L for the Expenses tab. Gross profit is computed from order lines
 * (revenue − COGS) using each product's current cost price (cost isn't
 * snapshotted on the line yet — Phase 5). Cancelled orders are excluded.
 */
export async function getExpenseSummary(
  storeId: string | null,
  range: DateRange,
): Promise<ExpenseSummary> {
  const empty: ExpenseSummary = {
    revenueKobo: 0,
    cogsKobo: 0,
    grossProfitKobo: 0,
    expensesKobo: 0,
    netProfitKobo: 0,
  };
  if (!hasDatabase || !storeId) return empty;

  const [orders, expenseAgg] = await Promise.all([
    withRetry(() =>
      db.order.findMany({
        where: {
          storeId,
          status: { not: "cancelled" },
          createdAt: { gte: range.from, lte: range.to },
        },
        select: {
          // Net goods revenue = order total (after all discounts) minus shipping
          // (shipping is pass-through, not goods margin).
          totalKobo: true,
          shippingKobo: true,
          lines: {
            select: {
              quantity: true,
              product: { select: { costPriceKobo: true } },
            },
          },
        },
      }),
    ),
    withRetry(() =>
      db.expense.aggregate({
        where: { storeId, date: { gte: range.from, lte: range.to } },
        _sum: { amountKobo: true },
      }),
    ),
  ]);

  let revenueKobo = 0;
  let cogsKobo = 0;
  for (const o of orders) {
    revenueKobo += Number(o.totalKobo) - Number(o.shippingKobo);
    for (const l of o.lines) {
      cogsKobo += Number(l.product?.costPriceKobo ?? 0) * l.quantity;
    }
  }
  const grossProfitKobo = revenueKobo - cogsKobo;
  const expensesKobo = Number(expenseAgg._sum.amountKobo ?? 0);

  return {
    revenueKobo,
    cogsKobo,
    grossProfitKobo,
    expensesKobo,
    netProfitKobo: grossProfitKobo - expensesKobo,
  };
}
