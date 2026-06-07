"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Money } from "@/components/ui/money";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RefundLine {
  id: string;
  name: string;
  variant: string;
  qty: number;
  unitKobo: number;
  /** "Damaged" / "Unopened" / "Used" — set by the staff when checking in the package. */
  condition?: "unopened" | "used" | "damaged";
  /** Whether the item is selected for refund. */
  selected: boolean;
  /** Should the item go back into stock. Defaults OFF for damaged condition per §20. */
  restock: boolean;
}

interface RefundComposerProps {
  lines: RefundLine[];
  onLinesChange: (lines: RefundLine[]) => void;
  method: "original" | "transfer";
  onMethodChange: (m: "original" | "transfer") => void;
  note: string;
  onNoteChange: (n: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}

export function RefundComposer({
  lines,
  onLinesChange,
  method,
  onMethodChange,
  note,
  onNoteChange,
  onSubmit,
  loading,
}: RefundComposerProps) {
  function toggleSelected(id: string, v: boolean) {
    onLinesChange(lines.map((l) => (l.id === id ? { ...l, selected: v } : l)));
  }

  function toggleRestock(id: string, v: boolean) {
    onLinesChange(lines.map((l) => (l.id === id ? { ...l, restock: v } : l)));
  }

  const refundKobo = lines
    .filter((l) => l.selected)
    .reduce((a, l) => a + l.unitKobo * l.qty, 0);

  const hasDamagedRestock = lines.some((l) => l.condition === "damaged" && l.restock);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-[10px] font-bold uppercase tracking-wider text-fg-muted">
            <tr>
              <th className="px-3 py-2 w-8" />
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-right px-3 py-2">Qty</th>
              <th className="text-left px-3 py-2">Condition</th>
              <th className="text-left px-3 py-2">Restock</th>
              <th className="text-right px-3 py-2">Refund</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-2.5">
                  <Checkbox
                    checked={l.selected}
                    onCheckedChange={(v) => toggleSelected(l.id, v === true)}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-semibold">{l.name}</div>
                  <div className="text-[11px] text-fg-muted">{l.variant}</div>
                </td>
                <td className="px-3 py-2.5 text-right tabular">{l.qty}</td>
                <td className="px-3 py-2.5">
                  <Badge
                    tone={
                      l.condition === "damaged"
                        ? "danger"
                        : l.condition === "used"
                          ? "warning"
                          : "success"
                    }
                  >
                    {l.condition === "damaged"
                      ? "Damaged"
                      : l.condition === "used"
                        ? "Used"
                        : "Unopened"}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={l.restock}
                      onCheckedChange={(v) => toggleRestock(l.id, v === true)}
                      disabled={!l.selected}
                    />
                    <span
                      className={cn(
                        "text-xs",
                        l.restock ? "text-fg" : "text-fg-muted",
                      )}
                    >
                      {l.restock ? "Restock" : "Write off"}
                    </span>
                  </label>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {l.selected ? (
                    <Money kobo={l.unitKobo * l.qty} className="font-bold" />
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-surface-2 font-bold">
              <td colSpan={5} className="px-3 py-2.5 text-right">
                Total refund
              </td>
              <td className="px-3 py-2.5 text-right">
                <Money kobo={refundKobo} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {hasDamagedRestock && (
        <Alert
          tone="warning"
          icon={<AlertTriangle className="size-4" />}
          title="Damaged item set to restock"
          description="Damaged items are defaulted to 'Write off'. Toggle Restock only with explicit approval — items will return to sellable inventory."
        />
      )}

      <Field id="refund-method" label="Refund method">
        <RadioGroup
          value={method}
          onValueChange={(v) => onMethodChange(v as "original" | "transfer")}
        >
          {[
            { id: "original", label: "Original payment method", sub: "Standard 3–5 business days" },
            { id: "transfer", label: "Bank transfer", sub: "Same-day for verified accounts" },
          ].map((m) => (
            <label
              key={m.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-md border cursor-pointer",
                method === m.id
                  ? "border-brand-primary bg-info-bg"
                  : "border-border hover:border-border-strong",
              )}
            >
              <RadioGroupItem value={m.id} id={`rm-${m.id}`} />
              <div className="flex-1">
                <div className="text-sm font-semibold">{m.label}</div>
                <div className="text-xs text-fg-muted mt-0.5">{m.sub}</div>
              </div>
            </label>
          ))}
        </RadioGroup>
      </Field>

      <Field id="refund-note" label="Internal note" optional>
        <Textarea
          id="refund-note"
          rows={2}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Reason, customer conversation, etc."
        />
      </Field>

      <div className="flex justify-end gap-2">
        <Button variant="ghost">Cancel</Button>
        <Button onClick={onSubmit} loading={loading ?? false} disabled={refundKobo === 0}>
          Issue refund · <Money kobo={refundKobo} className="text-brand-primary-fg ml-1" />
        </Button>
      </div>
    </div>
  );
}
