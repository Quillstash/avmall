"use client";

import * as React from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { ProfitDisplay } from "@/components/admin/profit-display";
import { cn } from "@/lib/utils";

export interface VariantRow {
  /** Stable key — preserved across regenerations so React keys stay correct. */
  key: string;
  option1Value: string | null;
  option2Value: string | null;
  /** Composed display label, e.g. "Small / Red". */
  label: string;
  /** SKU is editable; defaults to a derived value. */
  sku: string;
  /** Units on hand for this combination. */
  stock: number;
  /** Optional override; null inherits product price. */
  priceOverrideKobo: number | null;
}

export interface VariantMatrixValue {
  option1Name: string;
  option2Name: string;
  option1Values: string[];
  option2Values: string[];
  variants: VariantRow[];
}

interface VariantMatrixProps {
  value: VariantMatrixValue;
  onChange: (next: VariantMatrixValue) => void;
  /** Product retail price in kobo — used to compute the per-variant profit hint. */
  productPriceKobo: number;
  /** Product cost in kobo — used to compute profit. */
  productCostKobo: number;
  /** Slug prefix for generated SKUs. */
  skuPrefix: string;
}

/**
 * Multi-variant editor. Two option groups (default "Size" × "Color"). Each
 * combination is a variant row with its own stock and optional price override.
 *
 * The component keeps state on Option 2 being optional — clear all values
 * there to collapse to a Size-only product.
 */
export function VariantMatrix({
  value,
  onChange,
  productPriceKobo,
  productCostKobo,
  skuPrefix,
}: VariantMatrixProps) {
  const [pendingO1, setPendingO1] = React.useState("");
  const [pendingO2, setPendingO2] = React.useState("");

  function regenerate(next: Partial<VariantMatrixValue>) {
    const merged = { ...value, ...next };
    const v1 = merged.option1Values.filter((s) => s.trim() !== "");
    const v2 = merged.option2Values.filter((s) => s.trim() !== "");

    // Build cartesian product. When v2 is empty, only v1 matters; when both
    // are empty, no variants (parent form should fall back to a single default).
    const combos: { o1: string | null; o2: string | null }[] = [];
    if (v1.length === 0 && v2.length === 0) {
      // none
    } else if (v2.length === 0) {
      for (const a of v1) combos.push({ o1: a, o2: null });
    } else if (v1.length === 0) {
      for (const b of v2) combos.push({ o1: null, o2: b });
    } else {
      for (const a of v1) for (const b of v2) combos.push({ o1: a, o2: b });
    }

    // Preserve existing stock/price/sku by matching the combo key.
    const keyFor = (o1: string | null, o2: string | null) => `${o1 ?? ""}|${o2 ?? ""}`;
    const oldByKey = new Map(merged.variants.map((v) => [keyFor(v.option1Value, v.option2Value), v]));

    const variants: VariantRow[] = combos.map((c) => {
      const k = keyFor(c.o1, c.o2);
      const existing = oldByKey.get(k);
      if (existing) {
        return {
          ...existing,
          label: composedLabel(c.o1, c.o2),
        };
      }
      return {
        key: k,
        option1Value: c.o1,
        option2Value: c.o2,
        label: composedLabel(c.o1, c.o2),
        sku: derivedSku(skuPrefix, c.o1, c.o2),
        stock: 0,
        priceOverrideKobo: null,
      };
    });

    onChange({ ...merged, variants });
  }

  function addO1Value() {
    const v = pendingO1.trim();
    if (!v || value.option1Values.includes(v)) {
      setPendingO1("");
      return;
    }
    regenerate({ option1Values: [...value.option1Values, v] });
    setPendingO1("");
  }

  function addO2Value() {
    const v = pendingO2.trim();
    if (!v || value.option2Values.includes(v)) {
      setPendingO2("");
      return;
    }
    regenerate({ option2Values: [...value.option2Values, v] });
    setPendingO2("");
  }

  function removeO1(v: string) {
    regenerate({ option1Values: value.option1Values.filter((x) => x !== v) });
  }
  function removeO2(v: string) {
    regenerate({ option2Values: value.option2Values.filter((x) => x !== v) });
  }

  function patchVariant(idx: number, patch: Partial<VariantRow>) {
    const next = [...value.variants];
    next[idx] = { ...next[idx]!, ...patch };
    onChange({ ...value, variants: next });
  }

  const totalStock = value.variants.reduce((a, v) => a + v.stock, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Option group editors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OptionGroupEditor
          name={value.option1Name}
          onNameChange={(n) => onChange({ ...value, option1Name: n })}
          values={value.option1Values}
          pending={pendingO1}
          setPending={setPendingO1}
          addValue={addO1Value}
          removeValue={removeO1}
          placeholder="e.g. Small, Medium, Large"
        />
        <OptionGroupEditor
          name={value.option2Name}
          onNameChange={(n) => onChange({ ...value, option2Name: n })}
          values={value.option2Values}
          pending={pendingO2}
          setPending={setPendingO2}
          addValue={addO2Value}
          removeValue={removeO2}
          placeholder="e.g. Red, Blue, Green"
        />
      </div>

      {/* Variants table */}
      {value.variants.length === 0 ? (
        <div className="text-sm text-fg-muted bg-surface-2 border border-dashed border-border rounded-md p-4 text-center">
          Add at least one value above to generate variants. With both groups
          filled in, every combination becomes its own variant.
        </div>
      ) : (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-xs font-bold uppercase tracking-wider text-fg-muted">
              {value.variants.length} variants · {totalStock} total stock
            </div>
            <div className="text-[11px] text-fg-muted">
              Leave price blank to inherit ₦{(productPriceKobo / 100).toLocaleString()}.
            </div>
          </div>
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-surface-2 text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="text-left px-3 py-2">Variant</th>
                  <th className="text-left px-3 py-2 w-40">SKU</th>
                  <th className="text-left px-3 py-2 w-24">Stock</th>
                  <th className="text-left px-3 py-2 w-36">Price (override)</th>
                  <th className="text-left px-3 py-2 w-44">Profit</th>
                </tr>
              </thead>
              <tbody>
                {value.variants.map((v, i) => {
                  const effectiveKobo = v.priceOverrideKobo ?? productPriceKobo;
                  return (
                    <tr key={v.key} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{v.label}</td>
                      <td className="px-3 py-2">
                        <Input
                          value={v.sku}
                          onChange={(e) => patchVariant(i, { sku: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={v.stock}
                          onChange={(e) =>
                            patchVariant(i, {
                              stock: Math.max(0, parseInt(e.target.value || "0", 10)),
                            })
                          }
                          className="h-8 tabular"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <PriceOverrideInput
                          value={v.priceOverrideKobo}
                          onChange={(next) =>
                            patchVariant(i, { priceOverrideKobo: next })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <ProfitDisplay
                          priceKobo={effectiveKobo}
                          costKobo={productCostKobo}
                          size="compact"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionGroupEditor({
  name,
  onNameChange,
  values,
  pending,
  setPending,
  addValue,
  removeValue,
  placeholder,
}: {
  name: string;
  onNameChange: (n: string) => void;
  values: string[];
  pending: string;
  setPending: (s: string) => void;
  addValue: () => void;
  removeValue: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="border border-border rounded-md p-3 bg-surface">
      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="font-semibold h-8 mb-2"
        placeholder="Option group name"
      />
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-7">
        {values.length === 0 && (
          <span className="text-xs text-fg-subtle italic">
            No values yet
          </span>
        )}
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-2 text-xs font-semibold"
          >
            {v}
            <button
              type="button"
              onClick={() => removeValue(v)}
              className="text-fg-muted hover:text-danger"
              aria-label={`Remove ${v}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addValue();
            }
          }}
          placeholder={placeholder}
          className="h-8 text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={addValue}
          disabled={!pending.trim()}
        >
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}

function PriceOverrideInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  // Editable in Naira but stored as kobo.
  const [draft, setDraft] = React.useState(value == null ? "" : String(value / 100));

  // Sync draft when value changes externally (e.g. matrix regenerated).
  React.useEffect(() => {
    setDraft(value == null ? "" : String(value / 100));
  }, [value]);

  return (
    <div className="flex items-center gap-1">
      <span className="text-fg-muted text-xs">₦</span>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const cleaned = e.target.value.trim();
          if (cleaned === "") {
            onChange(null);
            return;
          }
          const n = parseFloat(cleaned);
          if (!isNaN(n)) onChange(Math.round(n * 100));
        }}
        placeholder="inherit"
        className="h-8 tabular text-xs"
      />
    </div>
  );
}

function composedLabel(o1: string | null, o2: string | null): string {
  if (o1 && o2) return `${o1} / ${o2}`;
  return o1 ?? o2 ?? "Default";
}

function derivedSku(prefix: string, o1: string | null, o2: string | null): string {
  const parts = [prefix, o1, o2]
    .filter(Boolean)
    .map((p) => p!.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  return parts.join("-");
}

/** Helper for callers — produce an empty matrix value. */
export function emptyMatrix(opts?: { option1Name?: string; option2Name?: string }): VariantMatrixValue {
  return {
    option1Name: opts?.option1Name ?? "Size",
    option2Name: opts?.option2Name ?? "Color",
    option1Values: [],
    option2Values: [],
    variants: [],
  };
}
