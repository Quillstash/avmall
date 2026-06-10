/**
 * Order data layer. Falls back to mock data when DB is not configured.
 */

import "server-only";

import { db, hasDatabase } from "@/lib/db";
import {
  ORDERS_LIST as MOCK_ORDERS_LIST,
  ORDER_DETAIL_ITEMS as MOCK_DETAIL_ITEMS,
  ORDER_PAYMENTS as MOCK_PAYMENTS,
  type OrderListRow,
} from "@/lib/admin-mock-data";
import { PRODUCTS } from "@/lib/mock-data";
import type {
  OrderStatus,
  PaymentStatus,
} from "@/components/ui/status-pill";

/** Best-effort image lookup for order line items. Phase 5 will read
 *  ProductImage rows tied to R2 keys; for now we map by SKU prefix to the
 *  seeded demo set so order lines always have a thumbnail. */
function lineImageFor(skuOrSlug: string): string {
  const fromSlug = PRODUCTS.find((p) => p.slug === skuOrSlug);
  if (fromSlug) return fromSlug.imageUrl;
  const upper = skuOrSlug.toUpperCase();
  const fromBrand = PRODUCTS.find((p) =>
    upper.startsWith(p.brand.slice(0, 3).toUpperCase()),
  );
  if (fromBrand) return fromBrand.imageUrl;
  // Deterministic placeholder when nothing matches.
  return `https://picsum.photos/seed/${encodeURIComponent(skuOrSlug)}/200/200`;
}

export type { OrderListRow };

export interface OrderDetail {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  source: string;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    phone: string;
    blacklisted: boolean;
  } | null;
  shipping: {
    name: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
  };
  totals: {
    subtotalKobo: number;
    bulkDiscountKobo: number;
    couponDiscountKobo: number;
    manualDiscountKobo: number;
    shippingKobo: number;
    totalKobo: number;
    paidKobo: number;
    outstandingKobo: number;
  };
  appliedCouponCode: string | null;
  lines: {
    id: string;
    name: string;
    variant: string | null;
    sku: string;
    quantity: number;
    unitKobo: number;
    bulkDiscountKobo: number;
    bulkTierLabel: string | null;
    imageUrl: string;
  }[];
  payments: {
    id: string;
    method: string;
    amountKobo: number;
    reference: string | null;
    status: "pending" | "completed" | "failed" | "reversed";
    by: string;
    createdAt: Date;
  }[];
  notes: {
    id: string;
    text: string;
    author: string;
    createdAt: Date;
  }[];
  installmentPlan: {
    id: string;
    status: "active" | "completed" | "cancelled" | "defaulted";
    minPaymentKobo: number | null;
    targetPayoffDate: Date | null;
    note: string | null;
    createdAt: Date;
  } | null;
}

function mapDbStatusToView(s: string): OrderStatus {
  return s as OrderStatus;
}
function mapDbPaymentStatusToView(s: string): PaymentStatus {
  return s as PaymentStatus;
}

// ─── Admin list ───────────────────────────────────────────────────────────

export async function listAdminOrders(): Promise<OrderListRow[]> {
  if (!hasDatabase) {
    return [...MOCK_ORDERS_LIST];
  }

  const rows = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      lines: { select: { id: true } },
      createdBy: { select: { name: true } },
    },
  });

  return rows.map((o) => {
    const total = Number(o.totalKobo);
    const paid = Number(o.paidKobo);
    return {
      number: o.number,
      customerName: o.customer?.name ?? o.shipName,
      customerPhone: o.customer?.phone ?? o.shipPhone,
      customerEmail: o.customer?.email ?? null,
      items: o.lines.length,
      totalKobo: total,
      outstandingKobo: total - paid,
      payment: mapDbPaymentStatusToView(o.paymentStatus),
      status: mapDbStatusToView(o.status),
      source: o.source as OrderListRow["source"],
      createdAt: formatTimestamp(o.createdAt),
      createdBy: o.createdBy?.name ?? "Self-serve",
    };
  });
}

function formatTimestamp(d: Date): string {
  const now = new Date();
  const sameDay =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Africa/Lagos",
    });
  }
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Lagos",
  });
}

// ─── Admin detail ────────────────────────────────────────────────────────

export async function getAdminOrder(number: string): Promise<OrderDetail | null> {
  if (!hasDatabase) {
    // Synthesise a detail object from the mock fixtures so the admin order
    // detail page can still render in design-only mode.
    return mockOrderDetail(number);
  }

  const o = await db.order.findUnique({
    where: { number },
    include: {
      customer: true,
      lines: { include: { product: true, variant: true } },
      payments: {
        include: { recordedBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      notes: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      installmentPlan: true,
    },
  });
  if (!o) return null;

  const total = Number(o.totalKobo);
  const paid = Number(o.paidKobo);

  return {
    id: o.id,
    number: o.number,
    status: mapDbStatusToView(o.status),
    paymentStatus: mapDbPaymentStatusToView(o.paymentStatus),
    source: o.source,
    createdAt: o.createdAt,
    customer: o.customer
      ? {
          id: o.customer.id,
          name: o.customer.name,
          phone: o.customer.phone,
          blacklisted: o.customer.blacklisted,
        }
      : null,
    shipping: {
      name: o.shipName,
      phone: o.shipPhone,
      line1: o.shipLine1,
      line2: o.shipLine2,
      city: o.shipCity,
      state: o.shipState,
    },
    totals: {
      subtotalKobo: Number(o.subtotalKobo),
      bulkDiscountKobo: Number(o.bulkDiscountKobo),
      couponDiscountKobo: Number(o.couponDiscountKobo),
      manualDiscountKobo: Number(o.manualDiscountKobo),
      shippingKobo: Number(o.shippingKobo),
      totalKobo: total,
      paidKobo: paid,
      outstandingKobo: total - paid,
    },
    appliedCouponCode: o.appliedCouponCode,
    lines: o.lines.map((l) => ({
      id: l.id,
      name: l.nameSnapshot,
      variant: l.variantSnapshot,
      sku: l.skuSnapshot,
      quantity: l.quantity,
      unitKobo: Number(l.unitKobo),
      bulkDiscountKobo: Number(l.bulkDiscountKobo),
      bulkTierLabel: l.bulkTierLabel,
      imageUrl: lineImageFor(l.product?.slug ?? l.skuSnapshot),
    })),
    payments: o.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amountKobo: Number(p.amountKobo),
      reference: p.reference,
      status: p.status,
      by: p.recordedBy?.name ?? "Customer",
      createdAt: p.createdAt,
    })),
    notes: o.notes.map((n) => ({
      id: n.id,
      text: n.text,
      author: n.author?.name ?? "Staff",
      createdAt: n.createdAt,
    })),
    installmentPlan: o.installmentPlan
      ? {
          id: o.installmentPlan.id,
          status: o.installmentPlan.status,
          minPaymentKobo:
            o.installmentPlan.minPaymentKobo != null
              ? Number(o.installmentPlan.minPaymentKobo)
              : null,
          targetPayoffDate: o.installmentPlan.targetPayoffDate,
          note: o.installmentPlan.note,
          createdAt: o.installmentPlan.createdAt,
        }
      : null,
  };
}

function mockOrderDetail(number: string): OrderDetail {
  const subtotal = MOCK_DETAIL_ITEMS.reduce((a, i) => a + i.unitKobo * i.qty, 0);
  const bulkDiscount = MOCK_DETAIL_ITEMS.reduce((a, i) => a + i.discountKobo, 0);
  const coupon = 500000;
  const shipping = 350000;
  const total = subtotal - bulkDiscount - coupon + shipping;
  const paid = MOCK_PAYMENTS.filter((p) => p.status === "completed").reduce(
    (a, p) => a + p.amountKobo,
    0,
  );
  return {
    id: "mock-order",
    number,
    status: "processing",
    paymentStatus: "partial",
    source: "whatsapp",
    createdAt: new Date(),
    customer: {
      id: "c1",
      name: "Tolu Adeniyi",
      phone: "+234 803 421 7790",
      blacklisted: false,
    },
    shipping: {
      name: "Tolu Adeniyi",
      phone: "+234 803 421 7790",
      line1: "14 Bourdillon Road, Apt 3B",
      line2: null,
      city: "Ikoyi",
      state: "Lagos",
    },
    totals: {
      subtotalKobo: subtotal,
      bulkDiscountKobo: bulkDiscount,
      couponDiscountKobo: coupon,
      manualDiscountKobo: 0,
      shippingKobo: shipping,
      totalKobo: total,
      paidKobo: paid,
      outstandingKobo: total - paid,
    },
    appliedCouponCode: "JANUARY10",
    lines: MOCK_DETAIL_ITEMS.map((i) => ({
      id: String(i.id),
      name: i.name,
      variant: i.variant,
      sku: i.sku,
      quantity: i.qty,
      unitKobo: i.unitKobo,
      bulkDiscountKobo: i.discountKobo,
      bulkTierLabel: i.tier ?? null,
      imageUrl: i.imageUrl,
    })),
    payments: MOCK_PAYMENTS.map((p, i) => ({
      id: String(i),
      method: p.method,
      amountKobo: p.amountKobo,
      reference: p.txRef === "—" ? null : p.txRef,
      status: p.status,
      by: p.by,
      createdAt: new Date(),
    })),
    notes: [],
    installmentPlan: null,
  };
}

// ─── Customer-facing ─────────────────────────────────────────────────────

export interface CustomerOrderSummary {
  number: string;
  date: string;
  totalKobo: number;
  status: OrderStatus;
  items: number;
}

export async function listCustomerOrders(customerId: string): Promise<CustomerOrderSummary[]> {
  if (!hasDatabase) {
    return [
      { number: "AVM-2841", date: "Tue 14 Jan", totalKobo: 6294000, status: "confirmed", items: 3 },
      { number: "AVM-2811", date: "8 Jan", totalKobo: 18900000, status: "delivered", items: 6 },
      { number: "AVM-2790", date: "2 Jan", totalKobo: 8400000, status: "delivered", items: 2 },
      { number: "AVM-2754", date: "24 Dec", totalKobo: 14200000, status: "refunded", items: 4 },
    ];
  }
  const rows = await db.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { lines: { select: { id: true } } },
    take: 50,
  });
  return rows.map((o) => ({
    number: o.number,
    date: formatTimestamp(o.createdAt),
    totalKobo: Number(o.totalKobo),
    status: mapDbStatusToView(o.status),
    items: o.lines.length,
  }));
}

export async function getCustomerOrder(
  number: string,
  customerId: string | null,
): Promise<OrderDetail | null> {
  const o = await getAdminOrder(number);
  if (!o) return null;
  // Only return if the order belongs to the calling customer (when known).
  if (customerId && o.customer?.id !== customerId) return null;
  return o;
}
