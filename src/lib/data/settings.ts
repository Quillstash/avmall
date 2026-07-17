/**
 * Site settings used across the customer-facing storefront: contact channels,
 * social links, RC number, and editable homepage copy. Admin-editable at
 * /admin/settings — the DB `SiteSettings` row is the source of truth, with the
 * SITE constants / built-in copy as the hard fallback when the row (or
 * DATABASE_URL) is absent.
 *
 * Every "Chat with us" / contact-support link and the footer socials resolve
 * through here, so changing them in admin updates the storefront at once.
 */

import "server-only";

import { cache } from "react";
import { db, hasDatabase, withRetry } from "@/lib/db";
import { SITE } from "@/lib/site";
import { waLink } from "@/lib/contact-links";
import { isValidNigerianPhone, normaliseNigerianPhone } from "@/lib/phone";

/** Social platforms with links editable in admin (WhatsApp is handled via the
 *  support number). Matches the SocialIcon component's supported set. */
export type SocialPlatform = "instagram" | "twitter" | "tiktok";

export interface SiteSettings {
  /** WhatsApp number as entered by admin, e.g. "+2347034486614". */
  whatsapp: string;
  phone: string;
  email: string;
  address: string;
  /** CAC registration number shown in the footer. */
  rcNumber: string;
  /** Per-platform URL. "" = admin cleared it → hidden on the storefront. */
  social: Record<SocialPlatform, string>;
  wholesaleTitle: string;
  wholesaleSubtext: string;
}

const DEFAULT_WHOLESALE_TITLE = "Wholesale pricing, negotiated on WhatsApp.";
const DEFAULT_WHOLESALE_SUBTEXT =
  "Tiered bulk discounts, split payments, dedicated account manager — chat with us to get a quote for your shop.";

const FALLBACK: SiteSettings = {
  whatsapp: SITE.whatsappNumber,
  phone: SITE.phone,
  email: SITE.supportEmail,
  address: `${SITE.address.street}, ${SITE.address.city}, ${SITE.address.state}`,
  rcNumber: "7798804",
  social: {
    instagram: SITE.social.instagram,
    twitter: SITE.social.twitter,
    tiktok: SITE.social.tiktok,
  },
  wholesaleTitle: DEFAULT_WHOLESALE_TITLE,
  wholesaleSubtext: DEFAULT_WHOLESALE_SUBTEXT,
};

/**
 * The full site settings, admin-editable via /admin/settings. Reads the single
 * `SiteSettings` row; falls back to the SITE constants when there's no DB, no
 * row, or the query fails (Neon cold-start etc.) so pages always render.
 *
 * Wrapped in React `cache()` so multiple callers in one request (layout, footer,
 * page) share a single query.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  if (!hasDatabase) return FALLBACK;
  try {
    const row = await withRetry(() =>
      db.siteSettings.findUnique({ where: { key: "default" } }),
    );
    if (!row) return FALLBACK;
    return {
      whatsapp: row.storeWhatsapp || FALLBACK.whatsapp,
      phone: row.storePhone || FALLBACK.phone,
      email: row.storeEmail || FALLBACK.email,
      address: row.storeAddress || FALLBACK.address,
      rcNumber: row.rcNumber || FALLBACK.rcNumber,
      social: {
        // `??` (not `||`): a NULL column means "never set" → show the default;
        // an empty string means the admin cleared it → keep "" so it hides.
        instagram: row.socialInstagram ?? FALLBACK.social.instagram,
        twitter: row.socialTwitter ?? FALLBACK.social.twitter,
        tiktok: row.socialTiktok ?? FALLBACK.social.tiktok,
      },
      wholesaleTitle: row.wholesaleTitle || FALLBACK.wholesaleTitle,
      wholesaleSubtext: row.wholesaleSubtext || FALLBACK.wholesaleSubtext,
    };
  } catch {
    return FALLBACK;
  }
});

export interface StoreContact {
  whatsapp: string;
  phone: string;
  email: string;
  address: string;
}

/** Contact-channel subset of the site settings. */
export async function getStoreContact(): Promise<StoreContact> {
  const s = await getSiteSettings();
  return {
    whatsapp: s.whatsapp,
    phone: s.phone,
    email: s.email,
    address: s.address,
  };
}

export interface SocialLink {
  platform: SocialPlatform;
  label: string;
  url: string;
}

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  twitter: "X / Twitter",
  tiktok: "TikTok",
};

/** Social links that actually have a URL — blank ones are hidden. Ordered
 *  instagram → twitter → tiktok. */
export async function getSocialLinks(): Promise<SocialLink[]> {
  const s = await getSiteSettings();
  return (Object.keys(SOCIAL_LABELS) as SocialPlatform[])
    .filter((p) => s.social[p]?.trim())
    .map((p) => ({ platform: p, label: SOCIAL_LABELS[p], url: s.social[p] }));
}

/**
 * Build a wa.me link from an admin-entered number, tolerating Nigerian local
 * formats (0703…, 234703…, +234703…). Falls back to the raw value's digits if
 * the number isn't a recognisable Nigerian one, so it never throws.
 */
export function storeWaLink(number: string, message?: string): string {
  const normalised = isValidNigerianPhone(number)
    ? normaliseNigerianPhone(number)
    : number;
  return waLink(normalised, message);
}
