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
