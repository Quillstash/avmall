/**
 * Shipping-zone matching for the AI agent.
 *
 * The storefront picks a state from a fixed dropdown, so its value always
 * matches the canonical string stored on a ShippingZone. The AI agent, by
 * contrast, receives free-text from WhatsApp ("lagos", "Abuja", "Lagos state")
 * which never matches a case-sensitive `states: { has: state }` query — so the
 * agent silently fell back to the flat rate.
 *
 * These helpers normalise both sides before comparing, so "Abuja",
 * "FCT", "Federal Capital Territory" all resolve to the same zone as the
 * stored "FCT (Abuja)", and casing / a trailing "State" / punctuation no
 * longer matter.
 */

import "server-only";

import { db } from "@/lib/db";
import { NIGERIA_LGAS } from "@/lib/nigeria-lgas";

/**
 * Collapse a state string to a comparison key. Both the customer's free-text
 * and each zone's stored state run through this before comparison.
 *
 *   "Lagos" / "Lagos State" / "LAGOS"        → "lagos"
 *   "FCT (Abuja)" / "Abuja" / "FCT"          → "fct"
 *   "Akwa Ibom" / "Akwa-Ibom" / "akwaibom"   → "akwaibom"
 */
export function stateKey(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (!s) return "";
  // Every spelling of the Federal Capital Territory unifies to one key.
  if (s.includes("abuja") || s.includes("fct") || s.includes("federal capital")) {
    return "fct";
  }
  return s
    .replace(/\(.*?\)/g, " ") // drop parentheticals, e.g. "(Abuja)"
    .replace(/\bstate\b/g, " ") // drop a trailing/embedded "state"
    .replace(/[^a-z0-9]/g, ""); // strip spaces & punctuation
}

/**
 * Resolve free-text to the canonical Nigerian state name (a NIGERIA_LGAS key),
 * or null if it matches none. Lets the agent learn the exact string to pass
 * back into cart/quote and create_order.
 */
export function canonicalStateName(input: string): string | null {
  const key = stateKey(input);
  if (!key) return null;
  for (const name of Object.keys(NIGERIA_LGAS)) {
    if (stateKey(name) === key) return name;
  }
  return null;
}

/** Collapse an LGA / area string to a comparison key (casing + punctuation
 *  insensitive), mirroring {@link stateKey}. */
export function lgaKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Find the active shipping zone that covers a (possibly messy) state string.
 * Fetches active zones and matches in JS on the normalised key — a drop-in
 * for the old `db.shippingZone.findFirst({ where: { states: { has } } })`,
 * preserving the same createdAt-asc "first wins" behaviour.
 *
 * Returns the full Prisma row (BigInt money fields intact) or null.
 */
export async function findZoneForState(input: string) {
  const key = stateKey(input);
  if (!key) return null;
  const zones = await db.shippingZone.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  return zones.find((z) => z.states.some((s) => stateKey(s) === key)) ?? null;
}

/**
 * Find the active zone that prices a specific (state, LGA) — the most-specific
 * match. Normalises both sides so free-text from the AI agent still resolves.
 * Returns the zone row or null when no area override exists for that LGA.
 */
export async function findZoneForArea(stateInput: string, lgaInput: string) {
  const sKey = stateKey(stateInput);
  const lKey = lgaKey(lgaInput);
  if (!sKey || !lKey) return null;
  const areas = await db.shippingZoneArea.findMany({
    where: { zone: { active: true } },
    include: { zone: true },
    orderBy: { zone: { createdAt: "asc" } },
  });
  const match = areas.find(
    (a) => stateKey(a.state) === sKey && lgaKey(a.lga) === lKey,
  );
  return match?.zone ?? null;
}

export interface ResolvedShipping {
  /** Base delivery cost in kobo before any free-shipping is applied. */
  shippingKobo: number;
  /** True when this zone's free-over threshold is met by the subtotal. */
  freeShippingEligible: boolean;
  /** Matched zone id (for stamping onto the order); null for fallback/none. */
  zoneId: string | null;
  /** Display name + ETA of the matched zone/rate; null when nothing matched. */
  zone: { name: string; etaDays: string } | null;
  /** How the rate was resolved. */
  source: "area" | "state" | "fallback" | "none";
}

/**
 * Single source of truth for resolving a delivery cost from an address. Tries,
 * in order: an LGA-specific area price → a whole-state zone → the flat fallback.
 * `netSubtotalKobo` is the subtotal after bulk discounts, used to evaluate the
 * zone's free-over threshold.
 *
 * Used by the storefront cart quote, both checkout paths, and the AI agent so
 * every channel prices delivery identically (CLAUDE.md §1).
 */
export async function resolveShipping(opts: {
  state?: string | null | undefined;
  lga?: string | null | undefined;
  netSubtotalKobo: number;
}): Promise<ResolvedShipping> {
  const none: ResolvedShipping = {
    shippingKobo: 0,
    freeShippingEligible: false,
    zoneId: null,
    zone: null,
    source: "none",
  };
  if (!opts.state) return none;

  // 1. LGA-specific area price (most specific), then 2. whole-state zone.
  let source: ResolvedShipping["source"] = "state";
  let zone = opts.lga ? await findZoneForArea(opts.state, opts.lga) : null;
  if (zone) {
    source = "area";
  } else {
    zone = await findZoneForState(opts.state);
  }

  if (zone) {
    const freeShippingEligible =
      zone.freeOverKobo != null &&
      BigInt(Math.max(0, Math.round(opts.netSubtotalKobo))) >= zone.freeOverKobo;
    return {
      shippingKobo: Number(zone.baseRateKobo),
      freeShippingEligible,
      zoneId: zone.id,
      zone: { name: zone.name, etaDays: zone.etaDays },
      source,
    };
  }

  // 3. Flat fallback rate.
  const fb = await db.fallbackShipping.findFirst();
  if (fb?.enabled) {
    return {
      shippingKobo: Number(fb.flatRateKobo),
      freeShippingEligible: false,
      zoneId: null,
      zone: { name: "Standard", etaDays: fb.etaDays },
      source: "fallback",
    };
  }
  return none;
}
