/**
 * Per-product sales history: every unit of a product that was sold — when,
 * through which channel, by which staff member, to which customer, on which
 * order, and at what price. Powers the "Sales history" view on the product
 * page.
 *
 * Cancelled orders are excluded from the totals and the row list (they never
 * really sold). Money is integer kobo throughout.
 */
import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";
import { ORDER_SOURCE_LABELS } from "@/lib/order-source";

export interface ProductSaleRow {
  orderNumber: string;
  /** ISO of the order's created time (when the sale happened). */
  date: string;
  quantity: number;
  unitKobo: number;
  /** unitKobo × qty − line bulk discount. */
  lineTotalKobo: number;
  channel: string; // raw source value
  channelLabel: string; // pretty label
  staffName: string | null; // null → placed online / self-checkout
  customerName: string | null;
  storeName: string | null;
  orderStatus: string;
  paymentStatus: string;
  variant: string | null;
}

export interface ProductSalesHistory {
  unitsSold: number;
  ordersCount: number;
  revenueKobo: number;
  returnedUnits: number;
  firstSoldAt: string | null;
  lastSoldAt: string | null;
  byChannel: { channel: string; label: string; units: number; revenueKobo: number }[];
  byStaff: { name: string; units: number; revenueKobo: number }[];
  rows: ProductSaleRow[];
  /** Total non-cancelled sale lines; `rows` may be capped below this. */
  rowsTotal: number;
}

const EMPTY: ProductSalesHistory = {
  unitsSold: 0, ordersCount: 0, revenueKobo: 0, returnedUnits: 0,
  firstSoldAt: null, lastSoldAt: null, byChannel: [], byStaff: [], rows: [], rowsTotal: 0,
};

const ROW_CAP = 250;
const ONLINE = "Online / self-checkout";

export async function getProductSalesHistory(productId: string): Promise<ProductSalesHistory> {
  if (!hasDatabase) return EMPTY;

  const [lines, returned] = await Promise.all([
    withRetry(() =>
      db.orderLine.findMany({
        where: { productId, order: { status: { not: "cancelled" } } },
        select: {
          quantity: true,
          unitKobo: true,
          bulkDiscountKobo: true,
          variantSnapshot: true,
          order: {
            select: {
              number: true,
              source: true,
              status: true,
              paymentStatus: true,
              createdAt: true,
              createdBy: { select: { name: true } },
              customer: { select: { name: true } },
              store: { select: { name: true } },
            },
          },
        },
        orderBy: { order: { createdAt: "desc" } },
      }),
    ),
    withRetry(() =>
      db.returnLine.aggregate({
        _sum: { quantity: true },
        where: { orderLine: { productId } },
      }),
    ),
  ]);

  if (lines.length === 0) return { ...EMPTY, returnedUnits: returned._sum.quantity ?? 0 };

  let unitsSold = 0;
  let revenueKobo = 0;
  const orderNumbers = new Set<string>();
  const channelMap = new Map<string, { units: number; revenueKobo: number }>();
  const staffMap = new Map<string, { units: number; revenueKobo: number }>();

  const rows: ProductSaleRow[] = lines.map((l) => {
    const qty = l.quantity;
    const lineTotal = Number(l.unitKobo) * qty - Number(l.bulkDiscountKobo);
    const channel = l.order.source;
    const staffName = l.order.createdBy?.name ?? null;

    unitsSold += qty;
    revenueKobo += lineTotal;
    orderNumbers.add(l.order.number);

    const ch = channelMap.get(channel) ?? { units: 0, revenueKobo: 0 };
    ch.units += qty; ch.revenueKobo += lineTotal; channelMap.set(channel, ch);

    const staffKey = staffName ?? ONLINE;
    const st = staffMap.get(staffKey) ?? { units: 0, revenueKobo: 0 };
    st.units += qty; st.revenueKobo += lineTotal; staffMap.set(staffKey, st);

    return {
      orderNumber: l.order.number,
      date: l.order.createdAt.toISOString(),
      quantity: qty,
      unitKobo: Number(l.unitKobo),
      lineTotalKobo: lineTotal,
      channel,
      channelLabel: ORDER_SOURCE_LABELS[channel as keyof typeof ORDER_SOURCE_LABELS] ?? channel,
      staffName,
      customerName: l.order.customer?.name ?? null,
      storeName: l.order.store?.name ?? null,
      orderStatus: l.order.status,
      paymentStatus: l.order.paymentStatus,
      variant: l.variantSnapshot,
    };
  });

  // Rows are already newest-first; first/last from the ends.
  const lastSoldAt = rows[0]?.date ?? null;
  const firstSoldAt = rows[rows.length - 1]?.date ?? null;

  const byChannel = [...channelMap.entries()]
    .map(([channel, v]) => ({
      channel,
      label: ORDER_SOURCE_LABELS[channel as keyof typeof ORDER_SOURCE_LABELS] ?? channel,
      ...v,
    }))
    .sort((a, b) => b.units - a.units);

  const byStaff = [...staffMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.units - a.units);

  return {
    unitsSold,
    ordersCount: orderNumbers.size,
    revenueKobo,
    returnedUnits: returned._sum.quantity ?? 0,
    firstSoldAt,
    lastSoldAt,
    byChannel,
    byStaff,
    rows: rows.slice(0, ROW_CAP),
    rowsTotal: rows.length,
  };
}
