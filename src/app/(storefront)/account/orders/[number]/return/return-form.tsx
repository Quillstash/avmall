"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Money } from "@/components/ui/money";
import { Textarea } from "@/components/ui/textarea";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

type Condition = "unopened" | "used" | "damaged";

interface EligibleLine {
  id: string;
  name: string;
  variant: string | null;
  unitKobo: number;
  totalQty: number;
  remaining: number;
}

interface LineSelection {
  selected: boolean;
  quantity: number;
  condition: Condition;
}

export function ReturnRequestForm({
  orderNumber,
  windowEndsAt,
  lines,
}: {
  orderNumber: string;
  windowEndsAt: string;
  lines: EligibleLine[];
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const [selections, setSelections] = React.useState<Record<string, LineSelection>>(
    () =>
      Object.fromEntries(
        lines.map((l) => [
          l.id,
          { selected: false, quantity: 1, condition: "unopened" as Condition },
        ]),
      ),
  );

  function update(id: string, patch: Partial<LineSelection>) {
    setSelections((s) => ({ ...s, [id]: { ...s[id]!, ...patch } }));
  }

  const selectedLines = lines.filter((l) => selections[l.id]?.selected);
  const refundKobo = selectedLines.reduce((sum, l) => {
    const s = selections[l.id]!;
    return sum + l.unitKobo * s.quantity;
  }, 0);

  async function submit() {
    if (selectedLines.length === 0) {
      toast.error("Pick at least one item to return.");
      return;
    }
    if (reason.trim().length < 5) {
      toast.error("Tell us briefly why — at least 5 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber,
          reason: reason.trim(),
          lines: selectedLines.map((l) => {
            const s = selections[l.id]!;
            return {
              orderLineId: l.id,
              quantity: s.quantity,
              condition: s.condition,
            };
          }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not submit return request");
        return;
      }
      toast.success(`Return ${json.data.return.number} submitted`);
      router.push("/account/orders");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg mb-4"
      >
        <ArrowLeft className="size-3.5" /> Back to orders
      </Link>

      <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
        Request a return
      </h1>
      <p className="text-sm text-fg-muted mb-6">
        Order <span className="font-mono font-bold">#{orderNumber}</span> · return
        window closes{" "}
        {new Date(windowEndsAt).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>

      <div className="flex flex-col gap-3 mb-6">
        {lines.map((l) => {
          const s = selections[l.id]!;
          return (
            <div
              key={l.id}
              className={cn(
                "rounded-lg border p-4 transition-colors",
                s.selected ? "border-brand-primary bg-info-bg" : "border-border bg-surface",
              )}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={s.selected}
                  onChange={(e) => update(l.id, { selected: e.target.checked })}
                  className="size-4 mt-1 accent-brand-primary"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{l.name}</div>
                      {l.variant && (
                        <div className="text-xs text-fg-muted">{l.variant}</div>
                      )}
                      <div className="text-xs text-fg-muted mt-1">
                        {l.remaining} of {l.totalQty} still returnable
                      </div>
                    </div>
                    <Money kobo={l.unitKobo} className="text-sm font-semibold" />
                  </div>
                </div>
              </label>

              {s.selected && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 pl-7">
                  <Field id={`qty-${l.id}`} label="Quantity">
                    <QuantityStepper
                      value={s.quantity}
                      onChange={(q) =>
                        update(l.id, { quantity: Math.max(1, Math.min(l.remaining, q)) })
                      }
                      min={1}
                      max={l.remaining}
                      size="sm"
                    />
                  </Field>
                  <Field id={`cond-${l.id}`} label="Condition">
                    <div className="flex gap-1.5">
                      {(["unopened", "used", "damaged"] as Condition[]).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => update(l.id, { condition: c })}
                          className={
                            s.condition === c
                              ? "text-xs font-semibold px-3 py-1.5 rounded-md bg-brand-primary text-brand-primary-fg capitalize"
                              : "text-xs font-semibold px-3 py-1.5 rounded-md bg-surface-2 hover:bg-bg capitalize"
                          }
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 mb-6">
        <Field id="reason" label="Why are you returning these?" required>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="A short note helps us process this faster."
            rows={3}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border bg-surface-2">
        <div>
          <div className="text-xs text-fg-muted">Refund estimate</div>
          <Money kobo={refundKobo} className="text-xl font-bold" />
          <div className="text-[11px] text-fg-muted mt-0.5">
            Staff will confirm before issuing the refund.
          </div>
        </div>
        <Button onClick={submit} disabled={submitting || selectedLines.length === 0}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </div>
  );
}
