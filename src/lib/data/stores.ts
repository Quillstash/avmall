/**
 * Store data layer (admin). Lists physical stores with lightweight counts for
 * the management tab. Stock + staff live in their own tables; we just surface
 * the totals here.
 */

import "server-only";
import { db, hasDatabase } from "@/lib/db";

export interface StoreRow {
  id: string;
  name: string;
  slug: string;
  isMain: boolean;
  active: boolean;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  /** Staff whose home store this is. */
  staffCount: number;
  /** Distinct variants stocked at this store. */
  stockedVariants: number;
  /** Orders attributed to this store. */
  orderCount: number;
  createdAt: Date;
}

export async function listStores(): Promise<StoreRow[]> {
  if (!hasDatabase) return [];
  const stores = await db.store.findMany({
    orderBy: [{ isMain: "desc" }, { active: "desc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { staff: true, stock: true, orders: true } },
    },
  });
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    isMain: s.isMain,
    active: s.active,
    phone: s.phone,
    email: s.email,
    address: s.address,
    city: s.city,
    state: s.state,
    staffCount: s._count.staff,
    stockedVariants: s._count.stock,
    orderCount: s._count.orders,
    createdAt: s.createdAt,
  }));
}
