/**
 * Cross-entity admin search. Returns small grouped result sets for the global
 * top-bar dropdown. DB-backed; returns empty results when the DB isn't
 * configured.
 *
 * Each group is gated by the caller's permissions — a role only sees results
 * for entities it's allowed to view (CLAUDE.md §2.5, permissions server-side
 * always). The route passes the staff session's permission list.
 */

import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";

export interface AdminSearchHit {
  type: "order" | "product" | "customer" | "staff" | "discount" | "return";
  href: string;
  primary: string;
  secondary: string;
  meta?: string;
}

export interface AdminSearchResults {
  orders: AdminSearchHit[];
  products: AdminSearchHit[];
  customers: AdminSearchHit[];
  staff: AdminSearchHit[];
  discounts: AdminSearchHit[];
  returns: AdminSearchHit[];
  totalCount: number;
}

const EMPTY: AdminSearchResults = {
  orders: [],
  products: [],
  customers: [],
  staff: [],
  discounts: [],
  returns: [],
  totalCount: 0,
};

export async function searchAdminEntities(
  query: string,
  permissions: readonly string[] = [],
  perGroupLimit = 5,
): Promise<AdminSearchResults> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return EMPTY;

  if (!hasDatabase) {
    return EMPTY;
  }

  const can = (p: string) => permissions.includes(p);

  const [orders, products, customers, staff, discounts, returns] = await Promise.all([
    can("orders.view")
      ? withRetry(() =>
          db.order.findMany({
            where: {
              OR: [
                { number: { contains: q, mode: "insensitive" } },
                { shipName: { contains: q, mode: "insensitive" } },
                { shipPhone: { contains: q } },
                { customer: { name: { contains: q, mode: "insensitive" } } },
                { customer: { phone: { contains: q } } },
              ],
            },
            include: { customer: { select: { name: true, phone: true } } },
            orderBy: { createdAt: "desc" },
            take: perGroupLimit,
          }),
        )
      : Promise.resolve([]),
    can("products.view")
      ? withRetry(() =>
          db.product.findMany({
            where: {
              archivedAt: null,
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { brand: { contains: q, mode: "insensitive" } },
                { slug: { contains: q, mode: "insensitive" } },
              ],
            },
            select: { slug: true, name: true, brand: true, priceKobo: true, published: true },
            orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
            take: perGroupLimit,
          }),
        )
      : Promise.resolve([]),
    can("customers.view")
      ? withRetry(() =>
          db.customer.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
            select: { id: true, name: true, phone: true, email: true },
            orderBy: { createdAt: "desc" },
            take: perGroupLimit,
          }),
        )
      : Promise.resolve([]),
    can("staff.view")
      ? withRetry(() =>
          db.user.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
            select: {
              name: true,
              email: true,
              role: true,
              active: true,
              assignedRole: { select: { name: true } },
            },
            orderBy: { name: "asc" },
            take: perGroupLimit,
          }),
        )
      : Promise.resolve([]),
    can("discounts.view")
      ? withRetry(() =>
          db.discount.findMany({
            where: {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            },
            select: { id: true, code: true, name: true, active: true },
            orderBy: { createdAt: "desc" },
            take: perGroupLimit,
          }),
        )
      : Promise.resolve([]),
    can("returns.view")
      ? withRetry(() =>
          db.return.findMany({
            where: {
              OR: [
                { number: { contains: q, mode: "insensitive" } },
                { order: { number: { contains: q, mode: "insensitive" } } },
                { customer: { name: { contains: q, mode: "insensitive" } } },
              ],
            },
            select: {
              id: true,
              number: true,
              status: true,
              order: { select: { number: true } },
              customer: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: perGroupLimit,
          }),
        )
      : Promise.resolve([]),
  ]);

  const orderHits: AdminSearchHit[] = orders.map((o) => ({
    type: "order",
    href: `/admin/orders/${o.number}`,
    primary: o.number,
    secondary: o.customer?.name ?? o.shipName,
    meta: o.status,
  }));

  const productHits: AdminSearchHit[] = products.map((p) => ({
    type: "product",
    href: `/admin/products/${p.slug}`,
    primary: p.name,
    secondary: p.brand,
    meta: p.published ? "Live" : "Draft",
  }));

  const customerHits: AdminSearchHit[] = customers.map((c) => ({
    type: "customer",
    href: `/admin/customers/${c.id}`,
    primary: c.name,
    secondary: c.phone,
    ...(c.email && { meta: c.email }),
  }));

  const staffHits: AdminSearchHit[] = staff.map((u) => ({
    type: "staff",
    // No per-staff detail page — land on the staff list.
    href: `/admin/staff`,
    primary: u.name,
    secondary: u.email,
    meta: !u.active ? "Disabled" : (u.assignedRole?.name ?? u.role.replace(/_/g, " ")),
  }));

  const discountHits: AdminSearchHit[] = discounts.map((d) => ({
    type: "discount",
    href: `/admin/discounts/${d.id}/edit`,
    primary: d.name,
    secondary: d.code ?? "Automatic",
    meta: d.active ? "Active" : "Off",
  }));

  const returnHits: AdminSearchHit[] = returns.map((r) => ({
    type: "return",
    href: `/admin/returns/${r.id}`,
    primary: r.number,
    secondary: `${r.customer.name} · ${r.order.number}`,
    meta: r.status,
  }));

  return {
    orders: orderHits,
    products: productHits,
    customers: customerHits,
    staff: staffHits,
    discounts: discountHits,
    returns: returnHits,
    totalCount:
      orderHits.length +
      productHits.length +
      customerHits.length +
      staffHits.length +
      discountHits.length +
      returnHits.length,
  };
}
