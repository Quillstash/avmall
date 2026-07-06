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
