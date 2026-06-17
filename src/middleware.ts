/**
 * Edge middleware.
 *  - Gates /admin behind a valid staff session (CLAUDE.md §19).
 *  - Serves the per-store storefront at /s/<slug>: a shareable entry point
 *    that scopes the whole storefront to that store.
 *
 * In dev mode without NEXTAUTH_SECRET (= Neon not connected yet) we let
 * everything through so the admin UI is still browsable.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { STORE_COOKIE, STORE_SLUG_HEADER } from "@/lib/store-constants";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Per-store storefront: /s/<slug>/... serves the same storefront scoped to
  // <slug>. Strip the prefix so the existing routes handle it, tag the request
  // with the slug so first load resolves correctly (before the cookie round-
  // trips), and persist the choice in the store cookie so subsequent
  // un-prefixed navigation stays in-store. An unknown slug is validated
  // server-side and falls back to the main store.
  if (pathname.startsWith("/s/")) {
    const [, , slug, ...rest] = pathname.split("/");
    if (slug) {
      const url = req.nextUrl.clone();
      url.pathname = "/" + rest.join("/");
      const headers = new Headers(req.headers);
      headers.set(STORE_SLUG_HEADER, slug);
      const res = NextResponse.rewrite(url, { request: { headers } });
      res.cookies.set(STORE_COOKIE, slug, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
      return res;
    }
  }

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return NextResponse.next();

  const token = await getToken({ req, secret });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin-login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/s/:path*"],
};
