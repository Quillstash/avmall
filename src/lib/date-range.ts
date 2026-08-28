/**
 * Optional `?from=YYYY-MM-DD&to=YYYY-MM-DD` windows for CSV exports.
 *
 * Distinct from `resolveRevenueRange` in `data/reports.ts`, which always
 * resolves to a range (defaulting to the last 30 days) because a report must
 * plot *something*. An export with no date params must stay a full dump, so
 * absent params here mean "no filter" rather than a default window.
 *
 * Day boundaries are Lagos-local, not server-local: staff asking for "1–31
 * August" mean the Nigerian calendar days, and Vercel runs in UTC. Nigeria has
 * observed UTC+1 with no daylight saving since 1919, so the offset is a
 * constant rather than something to look up per date.
 */

const LAGOS_UTC_OFFSET = "+01:00";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight in Lagos on `ymd`, as a UTC instant. Null when malformed. */
export function lagosDayStart(ymd: string | null | undefined): Date | null {
  if (!ymd || !DATE_RE.test(ymd)) return null;
  const d = new Date(`${ymd}T00:00:00.000${LAGOS_UTC_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Midnight in Lagos on the day AFTER `ymd`. Used as an exclusive upper bound so
 * a `to` date includes everything that happened on that date — a `lte` on
 * midnight would drop all but the first instant of it.
 */
export function lagosDayEndExclusive(ymd: string | null | undefined): Date | null {
  const start = lagosDayStart(ymd);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export type ExportDateRange = {
  /** Inclusive lower bound, or null for "no lower bound". */
  from: Date | null;
  /** Exclusive upper bound, or null for "no upper bound". */
  to: Date | null;
  /** True when at least one bound was given and parsed. */
  active: boolean;
  /** Raw params echoed back, for the CSV header line and the filename. */
  fromYmd: string;
  toYmd: string;
  /** Filename-safe slug, e.g. `2026-08-01_to_2026-08-31` or `all-time`. */
  slug: string;
};

/**
 * Read an optional export window off a query string. Either bound may stand
 * alone ("everything since 1 August"); a reversed pair is swapped rather than
 * silently returning nothing.
 */
export function parseExportDateRange(sp: URLSearchParams): ExportDateRange {
  let fromYmd = sp.get("from")?.trim() ?? "";
  let toYmd = sp.get("to")?.trim() ?? "";

  if (!DATE_RE.test(fromYmd)) fromYmd = "";
  if (!DATE_RE.test(toYmd)) toYmd = "";
  if (fromYmd && toYmd && fromYmd > toYmd) [fromYmd, toYmd] = [toYmd, fromYmd];

  const from = lagosDayStart(fromYmd);
  const to = lagosDayEndExclusive(toYmd);
  const active = !!from || !!to;

  const slug = !active
    ? "all-time"
    : fromYmd && toYmd
      ? `${fromYmd}_to_${toYmd}`
      : fromYmd
        ? `from-${fromYmd}`
        : `until-${toYmd}`;

  return { from, to, active, fromYmd, toYmd, slug };
}

/** Human label for the CSV's period line, e.g. "1 Aug 2026 to 31 Aug 2026". */
export function describeExportRange(r: ExportDateRange): string {
  if (!r.active) return "All time";
  if (r.fromYmd && r.toYmd) return `${r.fromYmd} to ${r.toYmd}`;
  if (r.fromYmd) return `${r.fromYmd} onwards`;
  return `up to ${r.toYmd}`;
}
