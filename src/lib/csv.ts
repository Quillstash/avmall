/**
 * Tiny CSV builder — no library needed for the simple cases we have. Quoting
 * follows RFC 4180: wrap a value in quotes when it contains comma, newline, or
 * quote; double up any internal quotes.
 */

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : String(v);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  // CRLF per RFC 4180 — Excel + most spreadsheet tools prefer it.
  return lines.join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-z0-9._-]/gi, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Default ceiling on export rows, so one click can't pull a whole table
 * through Neon inside a 60s function. A date range is the intended way to get
 * past it.
 */
export const EXPORT_ROW_CAP = 10_000;

/**
 * Trim an over-fetched result to the cap. Fetch `cap + 1` rows and pass them
 * here: the extra row is what proves there were more.
 */
export function capRows<T>(rows: T[], cap: number): { rows: T[]; truncated: boolean } {
  if (rows.length <= cap) return { rows, truncated: false };
  return { rows: rows.slice(0, cap), truncated: true };
}

/**
 * A visible "there was more" row, so a truncated export can't be mistaken for
 * a complete one. The note sits in column 0 and every other cell is blank —
 * deliberately, so that a truncated products export still round-trips through
 * the bulk-stock importer, which skips rows with an empty stock cell.
 *
 * (A response header would be invisible here: exports are plain `<a download>`
 * links, so nothing in the app ever reads the response.)
 */
export function truncationRow(cap: number, width: number): string[] {
  const note = `— TRUNCATED: first ${cap.toLocaleString()} matching rows only. Narrow the date range or filters to get the rest. —`;
  return [note, ...Array<string>(Math.max(0, width - 1)).fill("")];
}
