/**
 * Rows-per-page choices for the server-paginated admin lists.
 *
 * This lives in a plain module — NOT beside the pager that renders it — on
 * purpose. The orders list page is a Server Component and needs this array to
 * validate `?size=`, but importing a value out of a `"use client"` module gives
 * the server a client-reference Proxy instead of the array, and the first
 * method call on it throws at request time ("Attempted to call includes() from
 * the server"). `next build` does not catch it, because the page is
 * force-dynamic and so is never prerendered.
 *
 * Keep it here, importable from both sides. The first entry is the default.
 */
export const PAGE_SIZES = [25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE: number = PAGE_SIZES[0];

/** Rows per page from a `?size=` param, or the default when it isn't offered. */
export function parsePageSize(v: string | undefined | null): number {
  const n = Number(v);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}
