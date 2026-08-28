"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

/**
 * "Export CSV" with an optional date window, for list screens that filter
 * client-side (products, customers) and so cannot express the window in the
 * URL the way the orders list does.
 *
 * The window therefore narrows the CSV only, never the table on screen — the
 * popover says as much, because a control that silently disagrees with the
 * list behind it is worse than no control.
 *
 * Leaving both dates empty downloads everything, which is what the button did
 * before this existed.
 */
export function ExportCsvButton({
  endpoint,
  label = "Export CSV",
  hint,
  params,
}: {
  /** API path, e.g. `/api/v1/admin/products/export`. */
  endpoint: string;
  label?: string;
  /** One line explaining what the dates mean for this entity. */
  hint: string;
  /** Extra query params to always include (e.g. the active category filter). */
  params?: Record<string, string>;
}) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const href = React.useMemo(() => {
    const qs = new URLSearchParams(params ?? {});
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const s = qs.toString();
    return s ? `${endpoint}?${s}` : endpoint;
  }, [endpoint, from, to, params]);

  const inputCls =
    "h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-fg outline-none focus:ring-2 focus:ring-brand-primary/30";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          <Download className="size-3.5" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-semibold text-fg">Date range</p>
        <p className="mt-1 text-xs text-fg-muted">{hint}</p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-fg-muted">
            From
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className={`mt-1 ${inputCls}`}
            />
          </label>
          <label className="text-xs font-semibold text-fg-muted">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className={`mt-1 ${inputCls}`}
            />
          </label>
        </div>

        <p className="mt-2 text-xs text-fg-subtle">
          {from || to
            ? "Only the download is filtered — the list on screen is unchanged."
            : "Leave both empty to export everything."}
        </p>

        <a href={href} download className="mt-3 block">
          <Button size="sm" className="w-full">
            <Download className="size-3.5" /> Download CSV
          </Button>
        </a>
      </PopoverContent>
    </Popover>
  );
}

ExportCsvButton.displayName = "ExportCsvButton";
