"use client";

import * as React from "react";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { ProfitDisplay } from "@/components/admin/profit-display";
import type { BulkTier } from "@/lib/mock-data";
import { applyPercentageDiscount } from "@/lib/money";

interface BulkTierEditorProps {
  tiers: BulkTier[];
  onChange: (tiers: BulkTier[]) => void;
  /** When provided, each tier row shows the effective unit profit at that tier. */
  priceKobo?: number;
  costKobo?: number;
}

/** Effective per-unit price after applying a single tier rule. */
function effectiveUnitKobo(tier: BulkTier, priceKobo: number): number {
  if (tier.type === "percentage") {
    return priceKobo - applyPercentageDiscount(priceKobo, tier.value);
  }
  return Math.max(0, priceKobo - tier.value);
}

export function BulkTierEditor({
  tiers,
  onChange,
  priceKobo,
  costKobo,
}: BulkTierEditorProps) {
  const showProfit = priceKobo != null && costKobo != null;
  function update(i: number, patch: Partial<BulkTier>) {
    const next = tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    onChange(next);
  }

  function remove(i: number) {
    onChange(tiers.filter((_, idx) => idx !== i));
  }

  function add() {
    const last = tiers[tiers.length - 1];
    const nextMin = last ? (last.max ?? last.min) + 1 : 2;
    onChange([
      ...tiers,
      { min: nextMin, max: null, type: "percentage", value: 5 },
    ]);
  }

  if (tiers.length === 0) {
    return (
      <button
        type="button"
        onClick={add}
        className="w-full py-4 border-2 border-dashed border-border rounded-md text-sm text-fg-muted hover:border-brand-primary hover:text-brand-primary hover:bg-info-bg inline-flex items-center justify-center gap-1.5"
      >
        <Plus className="size-4" />
        Add bulk tier
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tiers.map((tier, i) => (
        <div
          key={i}
          className="relative rounded-md border border-border bg-surface p-3 pr-10"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Labeled label="Min qty">
              <NumberInput
                value={tier.min}
                onChange={(n) => update(i, { min: Math.max(1, n) })}
                min={1}
                className="h-9"
              />
            </Labeled>
            <Labeled label="Max qty">
              <NumberInput
                value={tier.max ?? 0}
                onChange={(n) => update(i, { max: n === 0 ? null : n })}
                min={0}
                placeholder="∞"
                className="h-9"
              />
            </Labeled>
            <Labeled label="Discount type">
              <Select
                value={tier.type}
                onChange={(e) => update(i, { type: e.target.value as BulkTier["type"] })}
                className="h-9 text-xs"
              >
                <option value="percentage">% off</option>
                <option value="fixed">₦ off (per unit)</option>
              </Select>
            </Labeled>
            <Labeled label="Value">
              {tier.type === "percentage" ? (
                <NumberInput
                  value={tier.value}
                  onChange={(n) => update(i, { value: Math.min(100, Math.max(0, n)) })}
                  min={0}
                  max={100}
                  suffix="%"
                  className="h-9"
                />
              ) : (
                <CurrencyInput
                  valueKobo={tier.value}
                  onValueChange={(kobo) => update(i, { value: kobo ?? 0 })}
                  className="h-9"
                />
              )}
            </Labeled>
          </div>
          {showProfit && (
            <div className="mt-2.5 pt-2.5 border-t border-border flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-fg-muted">Profit / unit</span>
              <ProfitDisplay
                priceKobo={effectiveUnitKobo(tier, priceKobo!)}
                costKobo={costKobo!}
                size="compact"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove tier"
            className="absolute top-2 right-2 p-1.5 text-fg-muted hover:text-danger rounded-md hover:bg-surface-2"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={add} className="self-start">
        <Plus className="size-3.5" /> Add tier
      </Button>
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
