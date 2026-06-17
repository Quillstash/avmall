/**
 * Store resolution helpers. Multi-store: stock + orders are scoped to a store.
 * — The storefront lands on the Main store; a cookie switches it.
 * — The POS + staff-created orders use the operator's home store.
 */

import "server-only";
import { cookies, headers } from "next/headers";
import { db, withRetry } from "./db";
import {
  STORE_COOKIE,
  ADMIN_STORE_COOKIE,
  STORE_SLUG_HEADER,
} from "./store-constants";
import { hasPermission } from "./permissions";

export { STORE_COOKIE, ADMIN_STORE_COOKIE };

type AdminStoreSession = {
  id: string;
  storeId?: string | null;
  role?: string;
  permissions?: readonly string[];
};

/** Full-coverage staff (super_admin/manager) can switch between stores. */
export function canSwitchStores(session: {
  role?: string;
  permissions?: readonly string[];
}): boolean {
  return hasPermission(
    {
      ...(session.role ? { role: session.role as never } : {}),
      ...(session.permissions ? { permissions: session.permissions } : {}),
    },
    "stores.view_all",
  );
}

/**
 * The admin's active store for the current request. Full-coverage staff get the
 * store they selected (ADMIN_STORE_COOKIE slug); everyone else is clamped to
 * their assigned store — the cookie is never trusted for non-coverage staff.
 */
export async function resolveAdminStoreId(
  session: AdminStoreSession,
): Promise<string | null> {
  if (canSwitchStores(session)) {
    const slug = cookies().get(ADMIN_STORE_COOKIE)?.value ?? null;
    if (slug) {
      const s = await getStoreBySlug(slug);
      if (s && s.active) return s.id;
    }
  }
  return resolveStaffStoreId(session);
}

/** The main store (bare storefront URL). Falls back to any active store. */
export async function getMainStore() {
  return withRetry(
    async () =>
      (await db.store.findFirst({ where: { isMain: true, active: true } })) ??
      (await db.store.findFirst({
        where: { active: true },
        orderBy: { createdAt: "asc" },
      })) ??
      (await db.store.findFirst({ orderBy: { createdAt: "asc" } })),
  );
}

export async function getMainStoreId(): Promise<string | null> {
  return (await getMainStore())?.id ?? null;
}

export async function getStoreBySlug(slug: string) {
  return withRetry(() => db.store.findUnique({ where: { slug } }));
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
  const u = await withRetry(() =>
    db.user.findUnique({
      where: { id: staff.id },
      select: { storeId: true },
    }),
  );
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
  // On a /s/<slug> request the middleware tags the slug as a header so the
  // first load resolves correctly; thereafter the cookie carries it.
  const slug =
    headers().get(STORE_SLUG_HEADER) ??
    cookies().get(STORE_COOKIE)?.value ??
    null;
  if (slug) {
    const s = await getStoreBySlug(slug);
    if (s && s.active) return s;
  }
  return getMainStore();
}

export async function getStorefrontStoreId(): Promise<string | null> {
  return (await getStorefrontStore())?.id ?? null;
}

/**
 * Active admin store for the current request, resolved from the logged-in
 * staff session. Returns null when there's no session. Use in admin server
 * components so they scope to the selected store without threading the session.
 */
export async function getActiveAdminStoreId(): Promise<string | null> {
  const { getStaffSession } = await import("./auth");
  const session = await getStaffSession();
  const user = session?.user as
    | { id: string; storeId?: string | null; role?: string; permissions?: string[] }
    | undefined;
  if (!user?.id) return null;
  return resolveAdminStoreId(user);
}

/**
 * The active admin store as a row (id + slug + isMain), for building the
 * "view storefront" link. Returns null when there's no session.
 */
export async function getActiveAdminStore() {
  const id = await getActiveAdminStoreId();
  if (!id) return null;
  return withRetry(() =>
    db.store.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, isMain: true },
    }),
  );
}

/** Active stores for the storefront switcher (lightweight). */
export async function listActiveStores() {
  return db.store.findMany({
    where: { active: true },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, city: true, state: true, isMain: true },
  });
}
