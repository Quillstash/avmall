"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";

interface ProfitDisplayProps {
  /** Sale price in kobo. */
  priceKobo: number;
  /** Internal cost in kobo. */
  costKobo: number;
  /** Optional caption above the profit numbers. */
  label?: string;
  /** Compact = single inline row; default = small card. */
  size?: "default" | "compact";
  className?: string;
}

/**
 * Internal-only profit box. Renders profit in ₦ and margin %. Never use on
 * customer-facing surfaces.
 */
export function ProfitDisplay({
  priceKobo,
  costKobo,
  label = "Profit per unit",
  size = "default",
  className,
}: ProfitDisplayProps) {
  const profitKobo = priceKobo - costKobo;
  // Margin: profit ÷ cost. When cost is 0 we can't divide, so show "—".
  const marginPct = costKobo > 0 ? (profitKobo / costKobo) * 100 : null;

  const positive = profitKobo > 0;
  const negative = profitKobo < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  const tone = positive
    ? "text-brand-accent bg-success-bg"
    : negative
      ? "text-danger bg-danger-bg"
      : "text-fg-muted bg-surface-2";

  if (size === "compact") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold",
          tone,
          className,
        )}
      >
        <Icon className="size-3" />
        <Money kobo={profitKobo} className="tabular" />
        <span className="opacity-70">·</span>
        <span className="tabular">
          {marginPct == null ? "—" : `${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(1)}%`}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border p-2.5 flex items-center gap-3",
        positive && "border-success/30",
        negative && "border-danger/30",
        !positive && !negative && "border-border",
        className,
      )}
    >
      <div
        className={cn(
          "size-8 rounded-full flex items-center justify-center flex-shrink-0",
          tone,
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
          {label}
        </div>
        <div className="flex items-baseline gap-2">
          <Money kobo={profitKobo} className="text-base font-bold tabular" />
          <span
            className={cn(
              "text-xs font-semibold tabular",
              positive && "text-brand-accent",
              negative && "text-danger",
              !positive && !negative && "text-fg-muted",
            )}
          >
            {marginPct == null
              ? "—"
              : `${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(1)}% margin`}
          </span>
        </div>
      </div>
    </div>
  );
}
