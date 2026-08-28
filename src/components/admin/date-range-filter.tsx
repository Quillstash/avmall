"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A plain from/to day picker for admin list screens, feeding both the list
 * filter and its CSV export.
 *
 * Distinct from `RevenueRangePicker`, which is preset-first (7/30/90 days) and
 * always has a range selected because a report must plot something. A list is
 * unfiltered until staff ask for a window, so this one starts empty, allows a
 * half-open range ("everything since 1 August"), and offers a clear button.
 *
 * The parent owns the values — usually URL params — so the server re-queries.
 */
export function DateRangeFilter({
  from,
  to,
  onApply,
  onClear,
  className,
}: {
  /** `YYYY-MM-DD`, or "" for unset. */
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
  className?: string;
}) {
  const [f, setF] = React.useState(from);
  const [t, setT] = React.useState(to);

  // Re-sync when the URL changes underneath us (back button, filter reset).
  React.useEffect(() => setF(from), [from]);
  React.useEffect(() => setT(to), [to]);

  const active = !!from || !!to;
  const dirty = f !== from || t !== to;
  const inputCls =
    "h-8 rounded-md border border-border-strong bg-surface px-2 text-xs text-fg outline-none focus:ring-2 focus:ring-brand-primary/30";

  return (
    <div className={className}>
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-fg-muted">Date</span>
        <input
          type="date"
          value={f}
          max={t || undefined}
          onChange={(e) => setF(e.target.value)}
          className={inputCls}
          aria-label="From date"
        />
        <span className="text-xs text-fg-muted">→</span>
        <input
          type="date"
          value={t}
          min={f || undefined}
          onChange={(e) => setT(e.target.value)}
          className={inputCls}
          aria-label="To date"
        />
        {/* Either bound alone is a valid window, so Apply needs only one. */}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onApply(f, t)}
          disabled={(!f && !t) || !dirty}
        >
          Apply
        </Button>
        {active && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setF("");
              setT("");
              onClear();
            }}
            aria-label="Clear date filter"
          >
            <X className="size-3.5" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}

DateRangeFilter.displayName = "DateRangeFilter";
