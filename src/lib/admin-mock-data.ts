/**
 * Shared admin view types + ROLE_LABELS only.
 * The seeded mock/fixture data was removed — data now comes from the database.
 * Money is always integer kobo.
 */

import type { OrderStatus, PaymentStatus } from "@/components/ui/status-pill";
import type { OrderSource } from "@/lib/order-source";

// ── Orders ────────────────────────────────────────────────────────────────

// Canonical channel union + labels live in one place; re-exported here so the
// many admin views that already import `OrderSource` from this module keep working.
export type { OrderSource };

export interface OrderListRow {
  number: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  items: number;
  totalKobo: number;
  outstandingKobo: number;
  payment: PaymentStatus;
  status: OrderStatus;
  source: OrderSource;
  createdAt: string;
  createdBy: string;
}

// ── Order detail (single fixture used by /admin/orders/[number]) ──────────

export interface OrderDetailItem {
  id: number;
  name: string;
  variant: string;
  sku: string;
  qty: number;
  unitKobo: number;
  discountKobo: number;
  tier?: string;
  imageUrl: string;
}

export interface OrderPayment {
  method: string;
  amountKobo: number;
  txRef: string;
  status: "completed" | "pending" | "failed";
  by: string;
  time: string;
}

// ── Customers ─────────────────────────────────────────────────────────────

export interface CustomerListRow {
  id: string;
  name: string;
  phone: string;
  email?: string;
  lifetimeKobo: number;
  orders: number;
  lastOrder: string;
  segments: string[];
  blacklisted?: boolean;
}

// ── Returns ───────────────────────────────────────────────────────────────

export type ReturnStatus =
  | "requested"
  | "approved"
  | "in_transit"
  | "received"
  | "refunded"
  | "rejected";

export interface ReturnListRow {
  id: string;
  orderNumber: string;
  customerName: string;
  itemCount: number;
  refundKobo: number;
  status: ReturnStatus;
  reason: string;
  /** True if the order is outside the 14-day return window. */
  outsideWindow?: boolean;
  /** True if all items in the source order have already been returned. */
  fullyReturned?: boolean;
  /** SLA breach indicator. */
  slaBreached?: boolean;
  createdAt: string;
}

// ── Discounts ─────────────────────────────────────────────────────────────

export type DiscountKind = "coupon" | "automatic" | "bulk";

export interface Discount {
  id: string;
  code?: string;
  kind: DiscountKind;
  name: string;
  /** "10%" or "₦5,000" formatted */
  valueLabel: string;
  scope: string;
  usage: number;
  usageLimit: number | null;
  validity: string;
  active: boolean;
  /** When >0, value & scope fields are locked (immutable after redemptions). */
  locked: boolean;
}

// ── Staff ─────────────────────────────────────────────────────────────────

export type StaffRole = "super_admin" | "manager" | "sales" | "inventory" | "support";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  /** Assigned dynamic role id + display name (null for legacy enum-only). */
  roleId?: string | null;
  roleName?: string | null;
  active: boolean;
  lastSeen: string;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super admin",
  manager: "Manager",
  sales: "Sales",
  inventory: "Inventory",
  support: "Support",
};

// ── Shipping zones ────────────────────────────────────────────────────────

export interface ShippingZone {
  id: string;
  name: string;
  states: string[];
  baseRateKobo: number;
  freeOverKobo: number | null;
  etaDays: string;
  active: boolean;
  /** Set if another zone covers some of the same states. */
  overlapsWith?: string[];
}
