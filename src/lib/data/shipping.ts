/**
 * Shipping zone data layer. Reads zones + fallback rate from the DB; returns
 * empty results when DATABASE_URL isn't set so the admin still renders.
 */

import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";
import { stateKey, lgaKey } from "@/lib/shipping-zone";

/** View shape used by the admin shipping page — matches the legacy mock so
 *  the existing UI keeps rendering with no further changes. */
export interface ShippingZoneView {
  id: string;
  name: string;
  states: string[];
  /** Sub-state coverage: specific (state, LGA) areas this zone prices. */
  areas: { state: string; lga: string }[];
  baseRateKobo: number;
  freeOverKobo: number | null;
  etaDays: string;
  active: boolean;
  /** Other active zones whose coverage genuinely collides with this one:
   *  they claim the same whole state, or price the exact same (state, LGA)
   *  area. A whole-state zone and an LGA-area zone in that state do NOT
   *  collide — the area price is more specific and wins (see resolveShipping). */
  overlapsWith?: string[];
}

export interface FallbackShippingView {
  enabled: boolean;
  flatRateKobo: number;
  etaDays: string;
}

/**
 * Flag zones whose coverage genuinely collides, matching how resolveShipping
 * actually picks a rate (LGA area beats whole state):
 *   - two zones claiming the SAME whole state  → collision (ambiguous for any
 *     LGA neither prices specifically);
 *   - two zones pricing the SAME (state, LGA) area → collision.
 * A whole-state zone plus an LGA-area zone in that state is fine — the area is
 * more specific and wins, so it's NOT flagged. Names are normalised (casing /
 * punctuation / a trailing "State") so "Kaduna" and "kaduna" still match.
 */
function annotateOverlaps(zones: ShippingZoneView[]): ShippingZoneView[] {
  const norm = zones.map((z) => ({
    id: z.id,
    active: z.active,
    stateKeys: new Set(z.states.map(stateKey).filter(Boolean)),
    areaKeys: new Set(
      z.areas
        .map((a) => ({ s: stateKey(a.state), l: lgaKey(a.lga) }))
        .filter((x) => x.s && x.l)
        .map((x) => `${x.s}::${x.l}`),
    ),
  }));
  const byId = new Map(norm.map((n) => [n.id, n]));

  return zones.map((z) => {
    const me = byId.get(z.id);
    // Only active zones can collide; an inactive zone never matches at checkout.
    if (!me || !z.active) return z;
    const overlaps = norm
      .filter((o) => o.id !== z.id && o.active)
      .filter(
        (o) =>
          [...me.stateKeys].some((s) => o.stateKeys.has(s)) ||
          [...me.areaKeys].some((a) => o.areaKeys.has(a)),
      )
      .map((o) => o.id);
    return overlaps.length > 0 ? { ...z, overlapsWith: overlaps } : z;
  });
}

export async function listShippingZones(): Promise<ShippingZoneView[]> {
  if (!hasDatabase) {
    return annotateOverlaps([]);
  }
  const rows = await withRetry(() =>
    db.shippingZone.findMany({
      orderBy: { name: "asc" },
      include: { areas: { orderBy: [{ state: "asc" }, { lga: "asc" }] } },
    }),
  );
  const view: ShippingZoneView[] = rows.map((z) => ({
    id: z.id,
    name: z.name,
    states: z.states,
    areas: z.areas.map((a) => ({ state: a.state, lga: a.lga })),
    baseRateKobo: Number(z.baseRateKobo),
    freeOverKobo: z.freeOverKobo == null ? null : Number(z.freeOverKobo),
    etaDays: z.etaDays,
    active: z.active,
  }));
  return annotateOverlaps(view);
}

export async function getFallbackShipping(): Promise<FallbackShippingView | null> {
  if (!hasDatabase) return null;
  const row = await withRetry(() => db.fallbackShipping.findFirst());
  if (!row) return null;
  return {
    enabled: row.enabled,
    flatRateKobo: Number(row.flatRateKobo),
    etaDays: row.etaDays,
  };
}

export interface CourierView {
  id: string;
  name: string;
  active: boolean;
  isPrimary: boolean;
  phone: string | null;
  trackingUrl: string | null;
  note: string | null;
}

export async function listCouriers(): Promise<CourierView[]> {
  if (!hasDatabase) return [];
  const rows = await withRetry(() =>
    db.courier.findMany({
      orderBy: [{ isPrimary: "desc" }, { position: "asc" }, { name: "asc" }],
    }),
  );
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    active: c.active,
    isPrimary: c.isPrimary,
    phone: c.phone,
    trackingUrl: c.trackingUrl,
    note: c.note,
  }));
}
