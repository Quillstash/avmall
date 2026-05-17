"use client";

import * as React from "react";
import { Plus, Minus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

interface StockAdjustProps {
  productSlug: string;
  variantId: string;
  variantLabel: string;
  currentStock: number;
  /** Called after a successful adjustment so the parent can refresh. */
  onAdjusted?: (newStock: number) => void;
}

const REASONS = [
  { id: "restock", label: "Restock — new shipment" },
  { id: "correction", label: "Inventory count correction" },
  { id: "damage", label: "Damaged / write-off" },
  { id: "return", label: "Return — back to shelf" },
  { id: "other", label: "Other (see note)" },
];

/**
 * Inline +/- stock control with a reason picker. Calls the server-side
 * stock-adjust endpoint which writes an audit-log entry. Permission-gated by
 * `products.stock_adjust` on the server.
 */
export function StockAdjust({
  productSlug,
  variantId,
  variantLabel,
  currentStock,
  onAdjusted,
}: StockAdjustProps) {
  const [delta, setDelta] = React.useState(1);
  const [direction, setDirection] = React.useState<"add" | "remove">("add");
  const [reason, setReason] = React.useState(REASONS[0]!.id);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const signed = direction === "add" ? delta : -delta;
  const projected = currentStock + signed;
  const wouldUnderflow = projected < 0;

  async function submit() {
    if (delta <= 0) return;
    if (wouldUnderflow) {
      toast.error(`Cannot remove ${delta} units — only ${currentStock} on hand.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/admin/products/${encodeURIComponent(productSlug)}/stock-adjust`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variantId,
            delta: signed,
            reason,
            ...(note.trim() && { note: note.trim() }),
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not adjust stock");
        return;
      }
      const newStock = json?.data?.onHand ?? projected;
      toast.success(
        `${variantLabel}: ${currentStock} → ${newStock} (${signed > 0 ? "+" : ""}${signed})`,
      );
      onAdjusted?.(newStock);
      setDelta(1);
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-md bg-surface-2 border border-border">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border border-border-strong bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setDirection("add")}
            className={
              direction === "add"
                ? "px-2 py-1.5 bg-brand-accent text-white text-xs font-bold"
                : "px-2 py-1.5 text-xs font-semibold text-fg-muted hover:bg-surface-2"
            }
            aria-label="Add stock"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDirection("remove")}
            className={
              direction === "remove"
                ? "px-2 py-1.5 bg-danger text-white text-xs font-bold"
                : "px-2 py-1.5 text-xs font-semibold text-fg-muted hover:bg-surface-2"
            }
            aria-label="Remove stock"
          >
            <Minus className="size-3.5" />
          </button>
        </div>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          value={delta}
          onChange={(e) => setDelta(Math.max(1, parseInt(e.target.value || "1", 10)))}
          className="h-8 w-20 tabular text-xs"
        />
        <span
          className={
            wouldUnderflow
              ? "text-xs text-danger font-semibold whitespace-nowrap"
              : "text-xs text-fg-muted whitespace-nowrap"
          }
        >
          → {projected}
        </span>
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          disabled={submitting || delta <= 0 || wouldUnderflow}
          onClick={submit}
        >
          {submitting && <Loader2 className="size-3.5 animate-spin" />}
          Apply
        </Button>
      </div>
      <Select value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 text-xs">
        {REASONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </Select>
      <Input
        placeholder="Optional note (visible in audit log)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="h-8 text-xs"
      />
    </div>
  );
}
