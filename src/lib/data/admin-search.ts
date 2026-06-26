/**
 * Cross-entity admin search. Returns small grouped result sets for the global
 * top-bar dropdown. DB-backed; returns empty results when the DB isn't
 * configured.
 */

import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";

export interface AdminSearchHit {
  type: "order" | "product" | "customer";
  href: string;
  primary: string;
  secondary: string;
  meta?: string;
}

export interface AdminSearchResults {
  orders: AdminSearchHit[];
  products: AdminSearchHit[];
  customers: AdminSearchHit[];
  totalCount: number;
}

const EMPTY: AdminSearchResults = {
  orders: [],
  products: [],
  customers: [],
  totalCount: 0,
};

export async function searchAdminEntities(
  query: string,
  perGroupLimit = 5,
): Promise<AdminSearchResults> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return EMPTY;

  if (!hasDatabase) {
    return EMPTY;
  }

  const [orders, products, customers] = await Promise.all([
    withRetry(() =>
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
    ),
    withRetry(() =>
      db.product.findMany({
        where: {
          archivedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          slug: true,
          name: true,
          brand: true,
          priceKobo: true,
          published: true,
        },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        take: perGroupLimit,
      }),
    ),
    withRetry(() =>
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
    ),
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

  return {
    orders: orderHits,
    products: productHits,
    customers: customerHits,
    totalCount: orderHits.length + productHits.length + customerHits.length,
  };
}
