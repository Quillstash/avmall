/**
 * Report aggregators. Each function does the SQL grouping the corresponding
 * page renders. Kept thin so the routes/components stay focused on layout.
 */

import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";

// ─── Revenue ──────────────────────────────────────────────────────────────

export interface RevenueReport {
  rangeDays: number;
  totalRevenueKobo: number;
  totalOrders: number;
  aovKobo: number;
  byDay: { date: string; revenueKobo: number; orderCount: number }[];
  byPaymentMethod: { method: string; amountKobo: number; count: number }[];
  byChannel: { source: string; revenueKobo: number; orderCount: number }[];
}

export async function getRevenueReport(rangeDays = 30): Promise<RevenueReport> {
  if (!hasDatabase) {
    return {
      rangeDays,
      totalRevenueKobo: 0,
      totalOrders: 0,
      aovKobo: 0,
      byDay: [],
      byPaymentMethod: [],
      byChannel: [],
    };
  }

  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  const [orders, payments] = await Promise.all([
    withRetry(() =>
      db.order.findMany({
        where: {
          createdAt: { gte: since },
          status: { notIn: ["cancelled"] },
        },
        select: {
          totalKobo: true,
          createdAt: true,
          source: true,
        },
      }),
    ),
    withRetry(() =>
      db.orderPayment.findMany({
        where: {
          createdAt: { gte: since },
          status: "completed",
        },
        select: { method: true, amountKobo: true },
      }),
    ),
  ]);

  const totalRevenueKobo = orders.reduce(
    (a, o) => a + Number(o.totalKobo),
    0,
  );
  const totalOrders = orders.length;
  const aovKobo = totalOrders > 0 ? Math.round(totalRevenueKobo / totalOrders) : 0;

  // Bucket by Lagos calendar day.
  const dayMap = new Map<string, { revenueKobo: number; orderCount: number }>();
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    dayMap.set(key, { revenueKobo: 0, orderCount: 0 });
  }
  for (const o of orders) {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(o.createdAt);
    const slot = dayMap.get(key);
    if (slot) {
      slot.revenueKobo += Number(o.totalKobo);
      slot.orderCount += 1;
    }
  }

  // By payment method
  const methodMap = new Map<string, { amountKobo: number; count: number }>();
  for (const p of payments) {
    const cur = methodMap.get(p.method) ?? { amountKobo: 0, count: 0 };
    cur.amountKobo += Number(p.amountKobo);
    cur.count += 1;
    methodMap.set(p.method, cur);
  }

  // By channel
  const channelMap = new Map<string, { revenueKobo: number; orderCount: number }>();
  for (const o of orders) {
    const cur = channelMap.get(o.source) ?? { revenueKobo: 0, orderCount: 0 };
    cur.revenueKobo += Number(o.totalKobo);
    cur.orderCount += 1;
    channelMap.set(o.source, cur);
  }

  return {
    rangeDays,
    totalRevenueKobo,
    totalOrders,
    aovKobo,
    byDay: Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v })),
    byPaymentMethod: Array.from(methodMap.entries())
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.amountKobo - a.amountKobo),
    byChannel: Array.from(channelMap.entries())
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.revenueKobo - a.revenueKobo),
  };
}

// ─── Inventory ────────────────────────────────────────────────────────────

export interface InventoryReport {
  totalSkus: number;
  outOfStock: number;
  lowStock: number;
  totalCostKobo: number;
  totalRetailKobo: number;
  projectedMarginPct: number | null;
  lowStockRows: {
    slug: string;
    name: string;
    brand: string;
    stock: number;
    costKobo: number;
    priceKobo: number;
  }[];
}

export async function getInventoryReport(): Promise<InventoryReport> {
  if (!hasDatabase) {
    return {
      totalSkus: 0,
      outOfStock: 0,
      lowStock: 0,
      totalCostKobo: 0,
      totalRetailKobo: 0,
      projectedMarginPct: null,
      lowStockRows: [],
    };
  }

  const products = await withRetry(() =>
    db.product.findMany({
      where: { archivedAt: null, published: true },
      select: {
        slug: true,
        name: true,
        brand: true,
        priceKobo: true,
        costPriceKobo: true,
        variants: { select: { onHand: true } },
      },
    }),
  );

  let totalCostKobo = 0;
  let totalRetailKobo = 0;
  let outOfStock = 0;
  let lowStock = 0;
  const lowStockRows: InventoryReport["lowStockRows"] = [];

  for (const p of products) {
    const stock = p.variants.reduce((a, v) => a + v.onHand, 0);
    const cost = Number(p.costPriceKobo);
    const price = Number(p.priceKobo);
    totalCostKobo += cost * stock;
    totalRetailKobo += price * stock;
    if (stock === 0) {
      outOfStock += 1;
    } else if (stock <= 5) {
      lowStock += 1;
      lowStockRows.push({
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        stock,
        costKobo: cost,
        priceKobo: price,
      });
    }
  }

  const projectedProfit = totalRetailKobo - totalCostKobo;
  const projectedMarginPct =
    totalCostKobo > 0 ? (projectedProfit / totalCostKobo) * 100 : null;

  // Sort low-stock by raw stock ascending so the most-urgent items are first
  lowStockRows.sort((a, b) => a.stock - b.stock);

  return {
    totalSkus: products.length,
    outOfStock,
    lowStock,
    totalCostKobo,
    totalRetailKobo,
    projectedMarginPct,
    lowStockRows: lowStockRows.slice(0, 50),
  };
}

// ─── Returns ──────────────────────────────────────────────────────────────

export interface ReturnsReport {
  rangeDays: number;
  totalReturns: number;
  refundedKobo: number;
  pending: number;
  outsideWindow: number;
  byReason: { reason: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export async function getReturnsReport(rangeDays = 30): Promise<ReturnsReport> {
  if (!hasDatabase) {
    return {
      rangeDays,
      totalReturns: 0,
      refundedKobo: 0,
      pending: 0,
      outsideWindow: 0,
      byReason: [],
      byStatus: [],
    };
  }
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const rows = await withRetry(() =>
    db.return.findMany({
      where: { createdAt: { gte: since } },
      select: {
        reason: true,
        status: true,
        refundKobo: true,
        outsideWindow: true,
      },
    }),
  );

  const reasonMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  let refundedKobo = 0;
  let pending = 0;
  let outsideWindow = 0;

  for (const r of rows) {
    const reason = r.reason.trim().toLowerCase() || "other";
    reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
    statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
    if (r.status === "refunded") refundedKobo += Number(r.refundKobo);
    if (r.status === "requested" || r.status === "approved" || r.status === "in_transit") {
      pending += 1;
    }
    if (r.outsideWindow) outsideWindow += 1;
  }

  return {
    rangeDays,
    totalReturns: rows.length,
    refundedKobo,
    pending,
    outsideWindow,
    byReason: Array.from(reasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    byStatus: Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
  };
}
