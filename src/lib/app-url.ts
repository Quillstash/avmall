import { env } from "@/lib/env";
import { SITE } from "@/lib/site";

/**
 * Base URL the app is ACTUALLY served from — used for links inside emails,
 * webhook callbacks, and the URLs the AI agent returns. Defaults to `SITE.url`
 * (the live custom domain). Only set `NEXT_PUBLIC_APP_URL` to override it for a
 * preview/staging deployment — leave it UNSET in production so links use the
 * custom domain, not the *.vercel.app URL.
 *
 *   appUrl()                         -> "https://www.avmall.com.ng"
 *   appUrl("/accept-invite/abc")     -> "https://www.avmall.com.ng/accept-invite/abc"
 */
export function appUrl(path = ""): string {
  const base = (env.NEXT_PUBLIC_APP_URL ?? SITE.url).replace(/\/+$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
