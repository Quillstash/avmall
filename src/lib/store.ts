/**
 * Store resolution helpers. Multi-store: stock + orders are scoped to a store.
 * — The storefront lands on the Main store; a cookie switches it.
 * — The POS + staff-created orders use the operator's home store.
 */

import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { STORE_COOKIE } from "./store-constants";

export { STORE_COOKIE };

/** The main store (bare storefront URL). Falls back to any active store. */
export async function getMainStore() {
  return (
    (await db.store.findFirst({ where: { isMain: true, active: true } })) ??
    (await db.store.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await db.store.findFirst({ orderBy: { createdAt: "asc" } }))
  );
}

export async function getMainStoreId(): Promise<string | null> {
  return (await getMainStore())?.id ?? null;
}

export async function getStoreBySlug(slug: string) {
  return db.store.findUnique({ where: { slug } });
}

/**
 * The store a staff member operates from: their home store, else Main. The
 * session carries storeId, but we fall back to the DB row then Main so callers
 * never have to special-case a missing session field.
 */
export async function resolveStaffStoreId(staff: {
  id: string;
  storeId?: string | null;
}): Promise<string | null> {
  if (staff.storeId) return staff.storeId;
  const u = await db.user.findUnique({
    where: { id: staff.id },
    select: { storeId: true },
  });
  if (u?.storeId) return u.storeId;
  return getMainStoreId();
}

/** Resolve the storefront's active store from a cookie slug; default to Main. */
export async function resolveStorefrontStoreId(
  slug?: string | null,
): Promise<string | null> {
  if (slug) {
    const s = await getStoreBySlug(slug);
    if (s && s.active) return s.id;
  }
  return getMainStoreId();
}

/**
 * The storefront's active store for the current request — read from the store
 * cookie, falling back to Main. Use in storefront server components. (Reading
 * the cookie makes the page render dynamically, which is what we want for
 * per-store stock.)
 */
export async function getStorefrontStore() {
  const slug = cookies().get(STORE_COOKIE)?.value ?? null;
  if (slug) {
    const s = await getStoreBySlug(slug);
    if (s && s.active) return s;
  }
  return getMainStore();
}

export async function getStorefrontStoreId(): Promise<string | null> {
  return (await getStorefrontStore())?.id ?? null;
}

/** Active stores for the storefront switcher (lightweight). */
export async function listActiveStores() {
  return db.store.findMany({
    where: { active: true },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, city: true, state: true, isMain: true },
  });
}
