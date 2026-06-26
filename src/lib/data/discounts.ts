/**
 * Discounts data layer. Returns the view-shape used by the admin discounts
 * page (with formatted value labels + a validity string).
 */

import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";
import { type Discount } from "@/lib/admin-mock-data";

export type { Discount };

function fmtLagosDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

function formatValueLabel(valueType: string, value: number): string {
  if (valueType === "percentage") return `${value}%`;
  if (valueType === "fixed") return `₦${(value / 100).toLocaleString("en-NG")}`;
  if (valueType === "free_shipping") return "Free shipping";
  return String(value);
}

function formatValidity(from: Date | null, until: Date | null): string {
  if (!from && !until) return "No expiry";
  if (from && until) return `${fmtLagosDate(from)} → ${fmtLagosDate(until)}`;
  if (until) return `Until ${fmtLagosDate(until)}`;
  return `From ${fmtLagosDate(from)}`;
}

export async function listDiscounts(): Promise<Discount[]> {
  if (!hasDatabase) {
    return [];
  }
  const rows = await withRetry(() =>
    db.discount.findMany({ orderBy: { createdAt: "desc" } }),
  );
  return rows.map((d) => ({
    id: d.id,
    ...(d.code && { code: d.code }),
    kind: d.kind as Discount["kind"],
    name: d.name,
    valueLabel: formatValueLabel(d.valueType, d.value),
    scope: d.scope,
    usage: d.usage,
    usageLimit: d.usageLimit,
    validity: formatValidity(d.validFrom, d.validUntil),
    active: d.active,
    locked: d.locked,
  }));
}
