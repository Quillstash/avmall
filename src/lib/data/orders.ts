/**
 * Order data layer. Returns empty results when the DB is not configured.
 */

import "server-only";

import { db, hasDatabase } from "@/lib/db";
import { type OrderListRow } from "@/lib/admin-mock-data";
import { SEED_PRODUCT_IMAGE_BY_SLUG } from "@/lib/seed-product-images";
import type {
  OrderStatus,
  PaymentStatus,
} from "@/components/ui/status-pill";

/** Image for an order line item. Seeded products resolve by slug from the
 *  CloudFront export (Phase 5 moves imagery to R2); otherwise a neutral
 *  branded placeholder. */
function lineImageFor(skuOrSlug: string): string {
  return SEED_PRODUCT_IMAGE_BY_SLUG[skuOrSlug] ?? "/product-placeholder.png";
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
  /** Derived from linked returns — drives the Returned / Partially returned badge. */
  returnState: "none" | "partial" | "full";
  returns: {
    number: string;
    status: string;
    refundKobo: number;
    fullyReturned: boolean;
    reason: string;
    createdAt: Date;
  }[];
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

export async function listAdminOrders(storeId?: string | null): Promise<OrderListRow[]> {
  if (!hasDatabase) {
    return [];
  }

  const rows = await db.order.findMany({
    ...(storeId ? { where: { storeId } } : {}),
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      lines: { select: { id: true } },
      createdBy: { select: { name: true } },
      returns: {
        where: { status: { not: "rejected" } },
        select: { fullyReturned: true },
      },
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
      returnState:
        o.returns.length === 0
          ? ("none" as const)
          : o.returns.some((r) => r.fullyReturned)
            ? ("full" as const)
            : ("partial" as const),
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
    return null;
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
      returns: {
        orderBy: { createdAt: "desc" },
        include: { lines: { select: { quantity: true } } },
      },
    },
  });
  if (!o) return null;

  const total = Number(o.totalKobo);
  const paid = Number(o.paidKobo);

  // Returns that landed on this order (anything not rejected). Drives the
  // "Returned / Partially returned" badge — a derived view, so the order status
  // machine stays untouched.
  const liveReturns = o.returns.filter((r) => r.status !== "rejected");
  const returnState: "none" | "partial" | "full" =
    liveReturns.length === 0
      ? "none"
      : liveReturns.some((r) => r.fullyReturned)
        ? "full"
        : "partial";

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
    returnState,
    returns: o.returns.map((r) => ({
      number: r.number,
      status: r.status,
      refundKobo: Number(r.refundKobo),
      fullyReturned: r.fullyReturned,
      reason: r.reason,
      createdAt: r.createdAt,
    })),
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

// ─── Customer-facing ─────────────────────────────────────────────────────

export interface CustomerOrderSummary {
  number: string;
  date: string;
  totalKobo: number;
  status: OrderStatus;
  items: number;
}

export async function listCustomerOrders(customerId: string): Promise<CustomerOrderSummary[]> {
  // No customer (guest) → no orders. Guards against passing an empty string to
  // the uuid `customerId` column, which Prisma rejects with a hard error.
  if (!hasDatabase || !customerId) {
    return [];
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
