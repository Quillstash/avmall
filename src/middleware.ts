/**
 * Edge middleware — gates /admin behind a valid staff session.
 * Per CLAUDE.md §19, any /admin route is blocked at the edge unless the
 * session is a valid staff session with TOTP cleared.
 *
 * In dev mode without NEXTAUTH_SECRET (= Neon not connected yet) we let
 * everything through so the admin UI is still browsable.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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

  if (token.pendingTotp) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin-login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
