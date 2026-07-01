/**
 * Profit analysis for the admin. For a date range and store, computes a full
 * P&L — net revenue, cost of goods sold, discounts given, expenses, and net
 * profit — plus per-product / per-category breakdowns and a stock snapshot.
 *
 * Profit chain:
 *   gross sales (selling price × qty)
 *   − discounts (bulk + coupon + manual)      = net revenue
 *   − cost of goods sold (cost price × qty)    = gross profit
 *   − operating expenses                       = net profit
 *
 * COGS uses each product's CURRENT cost price (order lines don't snapshot cost),
 * so it's an estimate when costs have changed since the sale.
 */
import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";

export interface ProductProfit {
  name: string;
  slug: string | null;
  unitsSold: number;
  revenueKobo: number;
  costKobo: number;
  profitKobo: number;
  marginPct: number | null;
}

export interface ProfitAnalysis {
  from: string;
  to: string;
  ordersCount: number;
  unitsSold: number;
  grossSalesKobo: number;
  discountKobo: number;
  netRevenueKobo: number;
  cogsKobo: number;
  grossProfitKobo: number;
  expensesKobo: number;
  netProfitKobo: number;
  marginPct: number | null;
  /** What net profit would have been with no discounts given. */
  profitBeforeDiscountKobo: number;
  topProducts: ProductProfit[];
  lossProducts: ProductProfit[];
  byCategory: { category: string; revenueKobo: number; profitKobo: number; unitsSold: number }[];
  expenseBreakdown: { type: string; amountKobo: number }[];
  inventory: {
    costKobo: number;
    retailKobo: number;
    lowStock: number;
    outOfStock: number;
    deadStock: number;
  };
}

const EMPTY: ProfitAnalysis = {
  from: "", to: "", ordersCount: 0, unitsSold: 0, grossSalesKobo: 0, discountKobo: 0,
  netRevenueKobo: 0, cogsKobo: 0, grossProfitKobo: 0, expensesKobo: 0, netProfitKobo: 0,
  marginPct: null, profitBeforeDiscountKobo: 0, topProducts: [], lossProducts: [], byCategory: [],
  expenseBreakdown: [], inventory: { costKobo: 0, retailKobo: 0, lowStock: 0, outOfStock: 0, deadStock: 0 },
};

const DAY = 86_400_000;

export async function getProfitAnalysis(
  range: { from: Date; to: Date } | number = 30,
  storeId?: string | null,
): Promise<ProfitAnalysis> {
  if (!hasDatabase) return EMPTY;
  const now = new Date();
  const to = typeof range === "number" ? now : range.from <= range.to ? range.to : range.from;
  const from =
    typeof range === "number"
      ? new Date(now.getTime() - (Math.max(1, range) - 1) * DAY)
      : range.from <= range.to ? range.from : range.to;

  const storeFilter = storeId ? { storeId } : {};
  const orderWhere = { ...storeFilter, createdAt: { gte: from, lt: to }, status: { notIn: ["cancelled" as const] } };

  const [orders, expenses, expenseTypes, products] = await Promise.all([
    withRetry(() =>
      db.order.findMany({
        where: orderWhere,
        select: {
          bulkDiscountKobo: true, couponDiscountKobo: true, manualDiscountKobo: true,
          lines: { select: { productId: true, quantity: true, unitKobo: true, bulkDiscountKobo: true, nameSnapshot: true } },
        },
      }),
    ),
    withRetry(() => db.expense.groupBy({ by: ["typeId"], _sum: { amountKobo: true }, where: { ...storeFilter, date: { gte: from, lt: to } } })),
    withRetry(() => db.expenseType.findMany({ select: { id: true, name: true } })),
    withRetry(() =>
      db.product.findMany({
        where: { ...storeFilter, archivedAt: null },
        select: {
          id: true, name: true, slug: true, costPriceKobo: true, priceKobo: true,
          category: { select: { slug: true } },
          variants: { select: { storeStock: { where: storeId ? { storeId } : {}, select: { onHand: true } } } },
        },
      }),
    ),
  ]);

  const prodById = new Map(products.map((p) => [p.id, p]));

  // ── P&L + per-product roll-up ───────────────────────────────────────────────
  let grossSalesKobo = 0, discountKobo = 0, cogsKobo = 0, unitsSold = 0;
  const perProduct = new Map<string, { name: string; slug: string | null; category: string; units: number; revenue: number; cost: number }>();
  const soldIds = new Set<string>();

  for (const o of orders) {
    discountKobo += Number(o.bulkDiscountKobo) + Number(o.couponDiscountKobo) + Number(o.manualDiscountKobo);
    for (const l of o.lines) {
      const qty = l.quantity;
      const lineGross = Number(l.unitKobo) * qty;
      const lineDisc = Number(l.bulkDiscountKobo);
      grossSalesKobo += lineGross;
      discountKobo += lineDisc;
      unitsSold += qty;
      soldIds.add(l.productId);
      const p = prodById.get(l.productId);
      const cost = Number(p?.costPriceKobo ?? 0) * qty;
      cogsKobo += cost;
      const key = l.productId;
      const agg = perProduct.get(key) ?? {
        name: p?.name ?? l.nameSnapshot, slug: p?.slug ?? null,
        category: p?.category.slug ?? "—", units: 0, revenue: 0, cost: 0,
      };
      agg.units += qty;
      agg.revenue += lineGross - lineDisc;
      agg.cost += cost;
      perProduct.set(key, agg);
    }
  }

  const netRevenueKobo = grossSalesKobo - discountKobo;
  const grossProfitKobo = netRevenueKobo - cogsKobo;
  const expensesKobo = expenses.reduce((a, e) => a + Number(e._sum.amountKobo ?? 0), 0);
  const netProfitKobo = grossProfitKobo - expensesKobo;

  const productProfits: ProductProfit[] = Array.from(perProduct.values()).map((p) => {
    const profit = p.revenue - p.cost;
    return { name: p.name, slug: p.slug, unitsSold: p.units, revenueKobo: p.revenue, costKobo: p.cost, profitKobo: profit, marginPct: p.revenue > 0 ? (profit / p.revenue) * 100 : null };
  });
  const topProducts = [...productProfits].sort((a, b) => b.profitKobo - a.profitKobo).slice(0, 10);
  const lossProducts = productProfits.filter((p) => p.profitKobo < 0).sort((a, b) => a.profitKobo - b.profitKobo).slice(0, 10);

  // ── category roll-up ────────────────────────────────────────────────────────
  const catMap = new Map<string, { revenueKobo: number; profitKobo: number; unitsSold: number }>();
  for (const p of perProduct.values()) {
    const c = catMap.get(p.category) ?? { revenueKobo: 0, profitKobo: 0, unitsSold: 0 };
    c.revenueKobo += p.revenue; c.profitKobo += p.revenue - p.cost; c.unitsSold += p.units;
    catMap.set(p.category, c);
  }
  const byCategory = Array.from(catMap.entries()).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.profitKobo - a.profitKobo);

  // ── expenses by type ────────────────────────────────────────────────────────
  const typeName = new Map(expenseTypes.map((t) => [t.id, t.name]));
  const expenseBreakdown = expenses
    .map((e) => ({ type: typeName.get(e.typeId) ?? "Other", amountKobo: Number(e._sum.amountKobo ?? 0) }))
    .sort((a, b) => b.amountKobo - a.amountKobo);

  // ── stock snapshot ──────────────────────────────────────────────────────────
  let invCost = 0, invRetail = 0, lowStock = 0, outOfStock = 0, deadStock = 0;
  for (const p of products) {
    const onHand = p.variants.reduce((a, v) => a + v.storeStock.reduce((b, s) => b + s.onHand, 0), 0);
    invCost += Number(p.costPriceKobo) * onHand;
    invRetail += Number(p.priceKobo) * onHand;
    if (onHand === 0) outOfStock++;
    else if (onHand < 20) lowStock++;
    if (onHand > 0 && !soldIds.has(p.id)) deadStock++;
  }

  return {
    from: from.toISOString(), to: to.toISOString(),
    ordersCount: orders.length, unitsSold,
    grossSalesKobo, discountKobo, netRevenueKobo, cogsKobo, grossProfitKobo, expensesKobo, netProfitKobo,
    marginPct: netRevenueKobo > 0 ? (netProfitKobo / netRevenueKobo) * 100 : null,
    profitBeforeDiscountKobo: grossSalesKobo - cogsKobo - expensesKobo,
    topProducts, lossProducts, byCategory, expenseBreakdown,
    inventory: { costKobo: invCost, retailKobo: invRetail, lowStock, outOfStock, deadStock },
  };
}
