/** Cookie holding the storefront's selected store slug. Shared by the server
 *  (reads it to scope stock) and the client switcher (writes it). Kept in its
 *  own module so client components can import it without pulling server-only
 *  code from `@/lib/store`. */
export const STORE_COOKIE = "avmall_store";

/** Cookie holding the *admin's* active store slug. Only honoured for staff
 *  with the `stores.view_all` permission (full coverage); everyone else is
 *  server-clamped to their assigned store regardless of this cookie. */
export const ADMIN_STORE_COOKIE = "avmall_admin_store";

/** Request header the middleware tags onto `/s/<slug>` storefront requests so
 *  the page resolves the right store on first load (before the cookie exists). */
export const STORE_SLUG_HEADER = "x-store-slug";

/** The public storefront path for a store: the main store owns the bare URL,
 *  every sub-store lives under `/s/<slug>`. Pure + edge/client-safe. */
export function storefrontPathForStore(store: {
  isMain: boolean;
  slug: string;
}): string {
  return store.isMain ? "/" : `/s/${store.slug}`;
}
