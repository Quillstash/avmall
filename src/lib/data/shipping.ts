/**
 * Shipping zone data layer. Reads zones + fallback rate from the DB; falls back
 * to admin-mock-data when DATABASE_URL isn't set so the admin still renders.
 */

import "server-only";

import { db, hasDatabase } from "@/lib/db";
import { SHIPPING_ZONES as MOCK_ZONES, type ShippingZone as MockZone } from "@/lib/admin-mock-data";

/** View shape used by the admin shipping page — matches the legacy mock so
 *  the existing UI keeps rendering with no further changes. */
export interface ShippingZoneView {
  id: string;
  name: string;
  states: string[];
  baseRateKobo: number;
  freeOverKobo: number | null;
  etaDays: string;
  active: boolean;
  /** Other zones that cover any of the same states. Computed client-side. */
  overlapsWith?: string[];
}

export interface FallbackShippingView {
  enabled: boolean;
  flatRateKobo: number;
  etaDays: string;
}

function annotateOverlaps(zones: ShippingZoneView[]): ShippingZoneView[] {
  return zones.map((z) => {
    const overlaps = zones
      .filter((other) => other.id !== z.id && other.active)
      .filter((other) => other.states.some((s) => z.states.includes(s)))
      .map((other) => other.id);
    return overlaps.length > 0 ? { ...z, overlapsWith: overlaps } : z;
  });
}

export async function listShippingZones(): Promise<ShippingZoneView[]> {
  if (!hasDatabase) {
    return annotateOverlaps((MOCK_ZONES as MockZone[]).map((z) => ({
      id: z.id,
      name: z.name,
      states: z.states,
      baseRateKobo: z.baseRateKobo,
      freeOverKobo: z.freeOverKobo,
      etaDays: z.etaDays,
      active: z.active,
    })));
  }
  const rows = await db.shippingZone.findMany({
    orderBy: { name: "asc" },
  });
  const view: ShippingZoneView[] = rows.map((z) => ({
    id: z.id,
    name: z.name,
    states: z.states,
    baseRateKobo: Number(z.baseRateKobo),
    freeOverKobo: z.freeOverKobo == null ? null : Number(z.freeOverKobo),
    etaDays: z.etaDays,
    active: z.active,
  }));
  return annotateOverlaps(view);
}

export async function getFallbackShipping(): Promise<FallbackShippingView | null> {
  if (!hasDatabase) {
    return { enabled: true, flatRateKobo: 900_000, etaDays: "5–7 days" };
  }
  const row = await db.fallbackShipping.findFirst();
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
  const rows = await db.courier.findMany({
    orderBy: [{ isPrimary: "desc" }, { position: "asc" }, { name: "asc" }],
  });
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
