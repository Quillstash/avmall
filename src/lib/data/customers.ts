/**
 * Customer data layer with mock fallback.
 */

import "server-only";

import { db, hasDatabase } from "@/lib/db";
import { type CustomerListRow } from "@/lib/admin-mock-data";

export type { CustomerListRow };

export interface AdminCustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  segments: string[];
  blacklisted: boolean;
  blacklistReason: string | null;
  lifetimeKobo: number;
  ordersCount: number;
  lastOrderAt: Date | null;
  createdAt: Date;
  /** Sum of outstanding balances on orders with an active installment plan. */
  installmentOutstandingKobo: number;
  activeInstallmentPlans: number;
}

export async function listCustomers(storeId?: string | null): Promise<CustomerListRow[]> {
  if (!hasDatabase) return [];

  const rows = await db.customer.findMany({
    ...(storeId ? { where: { storeId } } : {}),
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      orders: {
        select: { totalKobo: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return rows.map((c) => {
    const lifetime = c.orders.reduce((a, o) => a + Number(o.totalKobo), 0);
    const last = c.orders[0]?.createdAt;
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      ...(c.email && { email: c.email }),
      lifetimeKobo: lifetime,
      orders: c.orders.length,
      lastOrder: last ? formatDate(last) : "Never",
      segments: c.segments,
      ...(c.blacklisted && { blacklisted: true }),
    } satisfies CustomerListRow;
  });
}

// Loose UUID match — enough to keep non-UUID slugs from hitting Prisma.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCustomer(id: string): Promise<AdminCustomerDetail | null> {
  if (!hasDatabase) return null;
  // Guard against non-UUID slugs hitting Prisma (which would throw).
  if (!UUID_REGEX.test(id)) return null;
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      orders: {
        select: {
          totalKobo: true,
          paidKobo: true,
          createdAt: true,
          installmentPlan: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!c) return null;
  const lifetime = c.orders.reduce((a, o) => a + Number(o.totalKobo), 0);
  const activePlans = c.orders.filter((o) => o.installmentPlan?.status === "active");
  const installmentOutstanding = activePlans.reduce(
    (a, o) => a + Math.max(0, Number(o.totalKobo) - Number(o.paidKobo)),
    0,
  );
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    segments: c.segments,
    blacklisted: c.blacklisted,
    blacklistReason: c.blacklistReason,
    lifetimeKobo: lifetime,
    ordersCount: c.orders.length,
    lastOrderAt: c.orders[0]?.createdAt ?? null,
    createdAt: c.createdAt,
    installmentOutstandingKobo: installmentOutstanding,
    activeInstallmentPlans: activePlans.length,
  };
}

function formatDate(d: Date): string {
  const today = new Date();
  const diffDays = Math.floor(
    (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Lagos",
  });
}
