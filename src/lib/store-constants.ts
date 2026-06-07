/** Cookie holding the storefront's selected store slug. Shared by the server
 *  (reads it to scope stock) and the client switcher (writes it). Kept in its
 *  own module so client components can import it without pulling server-only
 *  code from `@/lib/store`. */
export const STORE_COOKIE = "avmall_store";
