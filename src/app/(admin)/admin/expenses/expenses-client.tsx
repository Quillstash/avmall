"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, Receipt } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Money } from "@/components/ui/money";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toaster";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  ExpenseRow,
  ExpenseTypeView,
  ExpenseSummary,
} from "@/lib/data/expenses";

const RANGES: { value: string; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "all", label: "All time" },
];

interface Props {
  types: ExpenseTypeView[];
  expenses: ExpenseRow[];
  summary: ExpenseSummary;
  rangeKey: string;
  rangeLabel: string;
  todayISO: string;
}

export function ExpensesClient({
  types: initialTypes,
  expenses,
  summary,
  rangeKey,
  rangeLabel,
  todayISO,
}: Props) {
  const router = useRouter();

  const [types, setTypes] = React.useState<ExpenseTypeView[]>(initialTypes);
  const [addOpen, setAddOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Add-expense form state.
  const [typeId, setTypeId] = React.useState("");
  const [amountKobo, setAmountKobo] = React.useState<number | null>(null);
  const [date, setDate] = React.useState(todayISO);
  const [note, setNote] = React.useState("");

  // Inline "new type" creation.
  const [showNewType, setShowNewType] = React.useState(false);
  const [newTypeName, setNewTypeName] = React.useState("");
  const [creatingType, setCreatingType] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  function openAdd() {
    setTypeId(types[0]?.id ?? "");
    setAmountKobo(null);
    setDate(todayISO);
    setNote("");
    setShowNewType(types.length === 0);
    setNewTypeName("");
    setAddOpen(true);
  }

  function changeRange(value: string) {
    router.push(`/admin/expenses?range=${value}`);
  }

  async function createType() {
    const name = newTypeName.trim();
    if (!name) return;
    setCreatingType(true);
    try {
      const res = await fetch("/api/v1/admin/expenses/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not add type");
        return;
      }
      const created = json.data as ExpenseTypeView;
      setTypes((prev) =>
        prev.some((t) => t.id === created.id)
          ? prev
          : [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setTypeId(created.id);
      setShowNewType(false);
      setNewTypeName("");
      toast.success(`Added type “${created.name}”`);
    } catch {
      toast.error("Network error");
    } finally {
      setCreatingType(false);
    }
  }

  async function submitExpense() {
    if (!typeId) {
      toast.error("Pick an expense type.");
      return;
    }
    if (!amountKobo || amountKobo <= 0) {
      toast.error("Enter an amount.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeId,
          amountKobo,
          date,
          ...(note.trim() && { note: note.trim() }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not add expense");
        return;
      }
      toast.success(`Expense of ${formatMoney(amountKobo)} added`);
      setAddOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/admin/expenses/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not delete expense");
        return;
      }
      toast.success("Expense deleted");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(false);
    }
  }

  const netPositive = summary.netProfitKobo >= 0;

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Expenses" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
          <PageHeader
            title="Expenses"
            subtitle="Operating costs, subtracted from gross profit to get net profit"
            actions={
              <div className="flex items-center gap-2">
                <div className="w-36">
                  <Select
                    value={rangeKey}
                    onChange={(e) => changeRange(e.target.value)}
                    aria-label="Date range"
                  >
                    {RANGES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button size="sm" onClick={openAdd}>
                  <Plus className="size-4" /> Add expense
                </Button>
              </div>
            }
          />

          {/* P&L summary for the selected period */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <SummaryCard label="Gross profit" value={summary.grossProfitKobo} />
            <SummaryCard
              label="Expenses"
              value={summary.expensesKobo}
              prefix="−"
              tone="muted"
            />
            <SummaryCard
              label="Net profit"
              value={summary.netProfitKobo}
              tone={netPositive ? "good" : "bad"}
              strong
            />
          </div>
          <p className="text-xs text-fg-muted mb-5 -mt-3">
            {rangeLabel} · gross profit = goods revenue − cost of goods sold;
            net profit = gross profit − expenses.
          </p>

          {/* Expense list */}
          <div className="rounded-lg border border-border bg-surface shadow-sm">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="text-sm font-bold">Recorded expenses</div>
              <span className="text-xs text-fg-muted">
                {expenses.length} {expenses.length === 1 ? "entry" : "entries"} ·{" "}
                {formatMoney(summary.expensesKobo)}
              </span>
            </div>

            {expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                <Receipt className="size-8 text-fg-subtle mb-3" />
                <p className="text-sm font-semibold">No expenses in this period</p>
                <p className="text-xs text-fg-muted mt-1">
                  Add rent, salaries, utilities and other operating costs to track
                  net profit.
                </p>
                <Button size="sm" variant="secondary" className="mt-4" onClick={openAdd}>
                  <Plus className="size-3.5" /> Add expense
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="text-[11px] font-bold uppercase tracking-wider text-fg-muted bg-surface-2">
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Type</th>
                      <th className="text-left px-4 py-2.5">Note</th>
                      <th className="text-left px-4 py-2.5">By</th>
                      <th className="text-right px-4 py-2.5">Amount</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-t border-border">
                        <td className="px-4 py-3 text-sm whitespace-nowrap tabular">
                          {e.dateLabel}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-2 text-xs font-medium">
                            {e.typeName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-fg-muted max-w-[280px] truncate">
                          {e.note ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-fg-muted">{e.by}</td>
                        <td className="px-4 py-3 text-right font-bold tabular">
                          <Money kobo={e.amountKobo} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDeleteTarget(e)}
                            className="p-1.5 text-fg-muted hover:text-danger"
                            aria-label="Delete expense"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add expense dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !submitting && setAddOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-2">
            <Field id="exp-type" label="Expense type">
              {showNewType ? (
                <div className="flex items-center gap-2">
                  <Input
                    id="exp-type"
                    autoFocus
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="e.g. Rent, Salaries, Utilities"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void createType();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={createType}
                    disabled={creatingType || !newTypeName.trim()}
                  >
                    {creatingType && <Loader2 className="size-3.5 animate-spin" />}
                    Add
                  </Button>
                  {types.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowNewType(false);
                        setNewTypeName("");
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Select
                    id="exp-type"
                    value={typeId}
                    onChange={(e) => setTypeId(e.target.value)}
                    className="flex-1"
                  >
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setShowNewType(true);
                      setNewTypeName("");
                    }}
                  >
                    <Plus className="size-3.5" /> New type
                  </Button>
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="exp-amount" label="Amount">
                <CurrencyInput
                  id="exp-amount"
                  {...(amountKobo != null ? { valueKobo: amountKobo } : {})}
                  placeholder="₦0"
                  onValueChange={(v) => setAmountKobo(v)}
                />
              </Field>
              <Field id="exp-date" label="Date">
                <Input
                  id="exp-date"
                  type="date"
                  value={date}
                  max={todayISO}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
            </div>

            <Field id="exp-note" label="Note (optional)">
              <Textarea
                id="exp-note"
                rows={2}
                placeholder="What was this for?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setAddOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitExpense}
              disabled={submitting || showNewType || types.length === 0}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Add expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this expense?"
        description={
          deleteTarget ? (
            <>
              Remove the {deleteTarget.typeName} expense of{" "}
              <span className="font-semibold">
                {formatMoney(deleteTarget.amountKobo)}
              </span>{" "}
              from {deleteTarget.dateLabel}. This can&apos;t be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function SummaryCard({
  label,
  value,
  prefix,
  tone = "default",
  strong,
}: {
  label: string;
  value: number;
  prefix?: string;
  tone?: "default" | "good" | "bad" | "muted";
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 tabular font-bold",
          strong ? "text-2xl" : "text-xl",
          tone === "good" && "text-brand-accent",
          tone === "bad" && "text-danger",
          tone === "muted" && "text-fg-muted",
        )}
      >
        {prefix}
        {formatMoney(Math.abs(value))}
      </div>
    </div>
  );
}
