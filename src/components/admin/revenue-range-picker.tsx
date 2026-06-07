"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Revenue range selector: preset day-counts + a live custom from/to picker.
 * Navigates to `basePath?range=N` (preset) or `basePath?from=…&to=…` (custom);
 * the server page reads those params to query the report. Reused on the
 * dashboard and the revenue report.
 */
export function RevenueRangePicker({
  basePath,
  activeRange,
  from,
  to,
}: {
  basePath: string;
  activeRange: number | null;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [f, setF] = React.useState(from);
  const [t, setT] = React.useState(to);

  React.useEffect(() => {
    setF(from);
    setT(to);
  }, [from, to]);

  function applyCustom() {
    if (f && t) router.push(`${basePath}?from=${f}&to=${t}`);
  }

  const inputCls =
    "h-8 rounded-md border border-border-strong bg-surface px-2 text-xs text-fg";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex p-0.5 bg-surface-2 rounded-md text-xs font-semibold">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => router.push(`${basePath}?range=${d}`)}
            className={
              activeRange === d
                ? "px-2.5 py-1 rounded-sm bg-surface shadow-sm text-fg"
                : "px-2.5 py-1 rounded-sm text-fg-muted hover:text-fg"
            }
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="inline-flex items-center gap-1.5">
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
        <Button size="sm" variant="secondary" onClick={applyCustom} disabled={!f || !t}>
          Apply
        </Button>
      </div>
    </div>
  );
}
