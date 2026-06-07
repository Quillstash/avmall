/**
 * Admin mock data — orders, customers, returns, discounts, staff, payments.
 * Real implementations will come from Prisma in Phase 4.
 * Money is always integer kobo.
 */

import type { OrderStatus, PaymentStatus } from "@/components/ui/status-pill";

// ── Orders ────────────────────────────────────────────────────────────────

export type OrderSource = "web" | "whatsapp" | "phone" | "walkin" | "ai";

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

export const ORDERS_LIST: readonly OrderListRow[] = [
  {
    number: "AVM-2841",
    customerName: "Tolu Adeniyi",
    customerEmail: null,
    customerPhone: "+234 803 421 7790",
    items: 3,
    totalKobo: 6294000,
    outstandingKobo: 2014000,
    payment: "partial",
    status: "processing",
    source: "whatsapp",
    createdAt: "2:14 PM today",
    createdBy: "Funmi A.",
  },
  {
    number: "AVM-2840",
    customerName: "Chiamaka O.",
    customerEmail: null,
    customerPhone: "+234 802 119 4421",
    items: 1,
    totalKobo: 1450000,
    outstandingKobo: 0,
    payment: "paid",
    status: "shipped",
    source: "web",
    createdAt: "1:48 PM today",
    createdBy: "Self-serve",
  },
  {
    number: "AVM-2839",
    customerName: "Bisi Akande",
    customerEmail: null,
    customerPhone: "+234 805 887 2210",
    items: 5,
    totalKobo: 12180000,
    outstandingKobo: 0,
    payment: "paid",
    status: "delivered",
    source: "web",
    createdAt: "12:02 PM today",
    createdBy: "Self-serve",
  },
  {
    number: "AVM-2838",
    customerName: "Emeka N.",
    customerEmail: null,
    customerPhone: "+234 803 552 1144",
    items: 2,
    totalKobo: 3960000,
    outstandingKobo: 3960000,
    payment: "unpaid",
    status: "pending",
    source: "ai",
    createdAt: "11:31 AM today",
    createdBy: "Ada (AI)",
  },
  {
    number: "AVM-2837",
    customerName: "Aisha M.",
    customerEmail: null,
    customerPhone: "+234 814 220 6688",
    items: 4,
    totalKobo: 8420000,
    outstandingKobo: 0,
    payment: "paid",
    status: "confirmed",
    source: "phone",
    createdAt: "11:08 AM today",
    createdBy: "Tunde I.",
  },
  {
    number: "AVM-2836",
    customerName: "Femi Alabi",
    customerEmail: null,
    customerPhone: "+234 802 444 7012",
    items: 1,
    totalKobo: 720000,
    outstandingKobo: 0,
    payment: "paid",
    status: "delivered",
    source: "web",
    createdAt: "10:42 AM today",
    createdBy: "Self-serve",
  },
  {
    number: "AVM-2835",
    customerName: "Ngozi U.",
    customerEmail: null,
    customerPhone: "+234 803 991 2204",
    items: 3,
    totalKobo: 5840000,
    outstandingKobo: 1500000,
    payment: "partial",
    status: "processing",
    source: "walkin",
    createdAt: "10:15 AM today",
    createdBy: "Tunde I.",
  },
  {
    number: "AVM-2834",
    customerName: "Olumide T.",
    customerEmail: null,
    customerPhone: "+234 805 220 9911",
    items: 2,
    totalKobo: 2980000,
    outstandingKobo: 0,
    payment: "paid",
    status: "shipped",
    source: "web",
    createdAt: "9:48 AM today",
    createdBy: "Self-serve",
  },
  {
    number: "AVM-2833",
    customerName: "Kemi B.",
    customerEmail: null,
    customerPhone: "+234 803 770 4422",
    items: 6,
    totalKobo: 14400000,
    outstandingKobo: 0,
    payment: "paid",
    status: "confirmed",
    source: "ai",
    createdAt: "9:14 AM today",
    createdBy: "Ada (AI)",
  },
  {
    number: "AVM-2832",
    customerName: "Ibrahim Y.",
    customerEmail: null,
    customerPhone: "+234 814 110 5566",
    items: 1,
    totalKobo: 4200000,
    outstandingKobo: 0,
    payment: "unpaid",
    status: "cancelled",
    source: "web",
    createdAt: "8:32 AM today",
    createdBy: "Self-serve",
  },
];

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

export const ORDER_DETAIL_ITEMS: readonly OrderDetailItem[] = [
  {
    id: 1,
    name: "Oraimo 50,000mAh Power Bank",
    variant: "Default",
    sku: "P4308826-V1",
    qty: 2,
    unitKobo: 6750000,
    discountKobo: 0,
    imageUrl:
      "https://dodptt9f4zk9h.cloudfront.net/stores/114586/products/27756b025a9c2d6488d67a8ac2991262b7099557.jpeg",
  },
  {
    id: 2,
    name: "Iwin 8\" Rotating Fan IW8008",
    variant: "Default",
    sku: "P4549000-V1",
    qty: 3,
    unitKobo: 1850000,
    discountKobo: 0,
    imageUrl:
      "https://dodptt9f4zk9h.cloudfront.net/stores/114586/products/320ea2208c5bb9ba051979c76574d957c654c091.jpeg",
  },
  {
    id: 3,
    name: "Bardefu 8-in-1 Blender",
    variant: "Default",
    sku: "P4368044-V1",
    qty: 1,
    unitKobo: 6200000,
    discountKobo: 0,
    imageUrl:
      "https://dodptt9f4zk9h.cloudfront.net/stores/114586/products/16b96bb03741180216280281b97797faecab8958.jpeg",
  },
];

export const ORDER_PAYMENTS: readonly OrderPayment[] = [
  {
    method: "Nuqood card",
    amountKobo: 2000000,
    txRef: "nq_a8c93f2e",
    status: "completed",
    by: "Customer",
    time: "14 Jan 2:18 PM",
  },
  {
    method: "Bank transfer",
    amountKobo: 1000000,
    txRef: "GTB-7841290",
    status: "completed",
    by: "Tunde I.",
    time: "14 Jan 3:42 PM",
  },
  {
    method: "Bank transfer",
    amountKobo: 2014000,
    txRef: "—",
    status: "pending",
    by: "Customer (awaiting)",
    time: "expected today",
  },
];

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

export const CUSTOMERS: readonly CustomerListRow[] = [
  {
    id: "c1",
    name: "Tolu Adeniyi",
    phone: "+234 803 421 7790",
    email: "tolu@example.com",
    lifetimeKobo: 184000000,
    orders: 14,
    lastOrder: "Today",
    segments: ["VIP", "Wholesale", "Lagos"],
  },
  {
    id: "c2",
    name: "Chiamaka O.",
    phone: "+234 802 119 4421",
    email: "chiamaka@example.com",
    lifetimeKobo: 42000000,
    orders: 6,
    lastOrder: "Today",
    segments: ["Lagos"],
  },
  {
    id: "c3",
    name: "Bisi Akande",
    phone: "+234 805 887 2210",
    email: "bisi.a@example.com",
    lifetimeKobo: 91000000,
    orders: 9,
    lastOrder: "Today",
    segments: ["VIP", "Lagos"],
  },
  {
    id: "c4",
    name: "Emeka N.",
    phone: "+234 803 552 1144",
    lifetimeKobo: 12000000,
    orders: 3,
    lastOrder: "Today",
    segments: ["Anambra"],
  },
  {
    id: "c5",
    name: "Aisha M.",
    phone: "+234 814 220 6688",
    email: "aisha.m@example.com",
    lifetimeKobo: 56000000,
    orders: 7,
    lastOrder: "Today",
    segments: ["Wholesale", "Kano"],
  },
  {
    id: "c6",
    name: "Henry W.",
    phone: "+234 802 999 0011",
    lifetimeKobo: 5400000,
    orders: 4,
    lastOrder: "12 days ago",
    segments: ["FCT"],
    blacklisted: true,
  },
];

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

export const RETURNS: readonly ReturnListRow[] = [
  {
    id: "RET-1208",
    orderNumber: "AVM-2790",
    customerName: "Tolu Adeniyi",
    itemCount: 2,
    refundKobo: 3200000,
    status: "received",
    reason: "Damaged in transit",
    createdAt: "8 Jan",
    slaBreached: true,
  },
  {
    id: "RET-1207",
    orderNumber: "AVM-2754",
    customerName: "Tolu Adeniyi",
    itemCount: 1,
    refundKobo: 4200000,
    status: "refunded",
    reason: "Wrong item delivered",
    createdAt: "24 Dec",
  },
  {
    id: "RET-1206",
    orderNumber: "AVM-2718",
    customerName: "Aisha M.",
    itemCount: 3,
    refundKobo: 12400000,
    status: "approved",
    reason: "Customer changed mind",
    createdAt: "10 Dec",
    fullyReturned: true,
  },
  {
    id: "RET-1205",
    orderNumber: "AVM-2690",
    customerName: "Bisi Akande",
    itemCount: 1,
    refundKobo: 980000,
    status: "rejected",
    reason: "Outside 14-day window",
    createdAt: "20 Nov",
    outsideWindow: true,
  },
];

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

export const DISCOUNTS: readonly Discount[] = [
  {
    id: "d1",
    code: "WELCOME10",
    kind: "coupon",
    name: "First-time customer 10% off",
    valueLabel: "10%",
    scope: "All products",
    usage: 1240,
    usageLimit: null,
    validity: "Always",
    active: true,
    locked: true,
  },
  {
    id: "d2",
    code: "JANUARY10",
    kind: "coupon",
    name: "January 10% off",
    valueLabel: "10%",
    scope: "All products",
    usage: 87,
    usageLimit: 500,
    validity: "Jan 1 – Jan 31",
    active: true,
    locked: true,
  },
  {
    id: "d3",
    code: "WHOLESALE15",
    kind: "coupon",
    name: "Wholesale partner 15% off",
    valueLabel: "15%",
    scope: "Wholesale segment",
    usage: 24,
    usageLimit: null,
    validity: "Always",
    active: true,
    locked: true,
  },
  {
    id: "d4",
    code: "HARMATTAN",
    kind: "coupon",
    name: "Harmattan collection 20%",
    valueLabel: "20%",
    scope: "Harmattan collection",
    usage: 0,
    usageLimit: 200,
    validity: "Feb 1 – Feb 28",
    active: false,
    locked: false,
  },
  {
    id: "d5",
    kind: "automatic",
    name: "Free shipping over ₦50k in Lagos",
    valueLabel: "Free shipping",
    scope: "Lagos zone · orders ≥ ₦50,000",
    usage: 4810,
    usageLimit: null,
    validity: "Always",
    active: true,
    locked: true,
  },
];

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

export const STAFF: readonly StaffMember[] = [
  { id: "s1", name: "Funmi A.", email: "funmi@avmall.ng", role: "manager", active: true, lastSeen: "just now" },
  { id: "s2", name: "Tunde I.", email: "tunde@avmall.ng", role: "sales", active: true, lastSeen: "12 min ago" },
  { id: "s3", name: "Adaeze K.", email: "adaeze@avmall.ng", role: "support", active: true, lastSeen: "1 hour ago" },
  { id: "s4", name: "Sodiq B.", email: "sodiq@avmall.ng", role: "inventory", active: true, lastSeen: "yesterday" },
  { id: "s5", name: "Hannah O.", email: "hannah@avmall.ng", role: "support", active: false, lastSeen: "3 weeks ago" },
];

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

export const SHIPPING_ZONES: readonly ShippingZone[] = [
  {
    id: "z1",
    name: "Lagos (intra-state)",
    states: ["Lagos"],
    baseRateKobo: 250000,
    freeOverKobo: 2500000,
    etaDays: "Same day – 24h",
    active: true,
  },
  {
    id: "z2",
    name: "South-West",
    states: ["Ogun", "Oyo", "Osun", "Ondo", "Ekiti"],
    baseRateKobo: 450000,
    freeOverKobo: 5000000,
    etaDays: "2–3 days",
    active: true,
  },
  {
    id: "z3",
    name: "South-East / South-South",
    states: ["Anambra", "Imo", "Rivers", "Cross River", "Akwa Ibom", "Bayelsa", "Abia", "Ebonyi", "Edo", "Delta"],
    baseRateKobo: 580000,
    freeOverKobo: null,
    etaDays: "3–5 days",
    active: true,
  },
  {
    id: "z4",
    name: "Abuja & North-Central",
    states: ["FCT (Abuja)", "Niger", "Nasarawa", "Plateau", "Kogi", "Kwara", "Benue"],
    baseRateKobo: 680000,
    freeOverKobo: null,
    etaDays: "3–5 days",
    active: true,
  },
  {
    id: "z5",
    name: "North-West / North-East",
    states: ["Kano", "Kaduna", "Bauchi", "Sokoto", "Kebbi", "Zamfara", "Katsina", "Jigawa", "Gombe", "Borno", "Yobe", "Adamawa", "Taraba"],
    baseRateKobo: 850000,
    freeOverKobo: null,
    etaDays: "4–6 days",
    active: true,
  },
  {
    id: "z6",
    name: "Lagos express (legacy)",
    states: ["Lagos"],
    baseRateKobo: 350000,
    freeOverKobo: null,
    etaDays: "Same day",
    active: false,
    overlapsWith: ["z1"],
  },
];
