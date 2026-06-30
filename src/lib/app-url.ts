import { env } from "@/lib/env";
import { SITE } from "@/lib/site";

/**
 * Base URL the app is ACTUALLY served from — used for links inside emails and
 * webhook callbacks. Set `NEXT_PUBLIC_APP_URL` to the live deployment (e.g. the
 * Vercel URL) until the custom domain is live; falls back to `SITE.url` (the
 * canonical domain used for SEO/metadata, which we never repoint).
 *
 *   appUrl()                         -> "https://avmall-nine.vercel.app"
 *   appUrl("/accept-invite/abc")     -> "https://avmall-nine.vercel.app/accept-invite/abc"
 */
export function appUrl(path = ""): string {
  const base = (env.NEXT_PUBLIC_APP_URL ?? SITE.url).replace(/\/+$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
