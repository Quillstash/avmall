"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { formatMoney } from "@/lib/money";
import {
  CalendarClock,
  Wallet,
  Plus,
  MoreHorizontal,
  Bell,
  CreditCard,
} from "lucide-react";

export interface InstallmentPlanView {
  id: string;
  status: "active" | "completed" | "cancelled" | "defaulted";
  minPaymentKobo: number | null;
  targetPayoffDate: string | null; // ISO
  note: string | null;
}

interface Props {
  orderNumber: string;
  plan: InstallmentPlanView | null;
  outstandingKobo: number;
  totalKobo: number;
  paidKobo: number;
  customerName: string | null;
  customerPhone: string | null;
  /** Opens the order's existing Record-payment modal. */
  onRecordPayment: () => void;
}

const STATUS_TONE = {
  active: "info",
  completed: "success",
  cancelled: "neutral",
  defaulted: "danger",
} as const;

export function InstallmentPanel({
  orderNumber,
  plan,
  outstandingKobo,
  totalKobo,
  paidKobo,
  customerName,
  customerPhone,
  onRecordPayment,
}: Props) {
  const router = useRouter();
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function api(method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderNumber}/installment-plan`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong");
      router.refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remind() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/admin/orders/${orderNumber}/installment-plan/remind`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok) toast.success(json?.data?.emailed ? "Reminder emailed" : "Reminder logged");
      else toast.error(json?.error?.message ?? "Could not send reminder");
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
    // Also offer a WhatsApp hand-off (outbound WA isn't automated yet).
    if (customerPhone) {
      const digits = customerPhone.replace(/\D/g, "");
      const msg = encodeURIComponent(
        `Hi${customerName ? " " + customerName : ""}, your order ${orderNumber} has an outstanding balance of ${formatMoney(
          outstandingKobo,
        )}. You can pay any amount towards it. Thank you!`,
      );
      window.open(`https://wa.me/${digits}?text=${msg}`, "_blank");
    }
  }

  // ── No plan yet: offer to set one up (only meaningful while there's a balance)
  if (!plan) {
    if (outstandingKobo <= 0) return null;
    return (
      <>
        <div className="rounded-lg p-5 lg:p-6 border border-border bg-surface-2/40">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-1.5 inline-flex items-center gap-1.5">
            <CreditCard className="size-3.5" /> Installment plan
          </div>
          <p className="text-sm text-fg-muted mb-3.5">
            Let the customer take the goods now and pay the balance over time.
          </p>
          <Button variant="secondary" onClick={() => setSetupOpen(true)}>
            <Plus className="size-3.5" /> Set up installment plan
          </Button>
        </div>
        <SetupDialog
          open={setupOpen}
          onOpenChange={setSetupOpen}
          outstandingKobo={outstandingKobo}
          busy={busy}
          onSubmit={async (data) => {
            const ok = await api("POST", data);
            if (ok) {
              setSetupOpen(false);
              toast.success("Installment plan created");
            }
          }}
        />
      </>
    );
  }

  const active = plan.status === "active";
  const pct = totalKobo > 0 ? Math.min(100, Math.round((paidKobo / totalKobo) * 100)) : 0;

  return (
    <div className="rounded-lg p-5 lg:p-6 border border-brand-primary/30 bg-info-bg/40">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-brand-primary inline-flex items-center gap-1.5">
          <CreditCard className="size-3.5" /> Installment plan
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[plan.status]} className="capitalize">
            {plan.status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 text-fg-muted hover:text-fg rounded-md hover:bg-surface"
                aria-label="Plan actions"
                disabled={busy}
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {active && (
                <DropdownMenuItem onClick={() => api("PATCH", { status: "defaulted" })}>
                  Mark defaulted
                </DropdownMenuItem>
              )}
              {active && (
                <DropdownMenuItem onClick={() => api("PATCH", { status: "cancelled" })}>
                  Cancel plan
                </DropdownMenuItem>
              )}
              {!active && plan.status !== "completed" && (
                <DropdownMenuItem onClick={() => api("PATCH", { status: "active" })}>
                  Reactivate plan
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => api("DELETE")}>
                Remove plan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="text-3xl lg:text-4xl font-bold tracking-tight tabular">
        {formatMoney(outstandingKobo)}
      </div>
      <div className="text-xs text-fg-muted mb-3">
        outstanding · {formatMoney(paidKobo)} of {formatMoney(totalKobo)} paid ({pct}%)
      </div>

      {/* progress */}
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mb-3.5">
        <div className="h-full bg-brand-primary" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-col gap-1 text-xs text-fg-muted mb-4">
        {plan.minPaymentKobo != null && (
          <div className="inline-flex items-center gap-1.5">
            <Wallet className="size-3.5" /> Minimum {formatMoney(plan.minPaymentKobo)} per payment
          </div>
        )}
        {plan.targetPayoffDate && (
          <div className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" /> Target payoff{" "}
            {new Date(plan.targetPayoffDate).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "Africa/Lagos",
            })}
          </div>
        )}
      </div>

      {active && (
        <div className="flex flex-col gap-2.5">
          <Button width="full" onClick={onRecordPayment}>
            <Plus className="size-3.5" /> Record payment
          </Button>
          <Button width="full" variant="secondary" onClick={remind} disabled={busy}>
            <Bell className="size-3.5" /> Remind customer
          </Button>
        </div>
      )}
      {plan.note && <p className="text-xs text-fg-muted mt-3 italic">“{plan.note}”</p>}
    </div>
  );
}

function SetupDialog({
  open,
  onOpenChange,
  outstandingKobo,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  outstandingKobo: number;
  busy: boolean;
  onSubmit: (data: {
    minPaymentKobo?: number;
    targetPayoffDate?: string;
    note?: string;
  }) => void;
}) {
  const [minKobo, setMinKobo] = React.useState<number | null>(null);
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setMinKobo(null);
      setDate("");
      setNote("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set up installment plan</DialogTitle>
          <DialogDescription>
            The customer keeps the goods and pays the {formatMoney(outstandingKobo)} balance
            over time. Both fields are optional.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              ...(minKobo != null && minKobo > 0 ? { minPaymentKobo: minKobo } : {}),
              ...(date ? { targetPayoffDate: date } : {}),
              ...(note.trim() ? { note: note.trim() } : {}),
            });
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <Field id="min" label="Minimum payment" optional hint="Smallest amount accepted per payment">
            <CurrencyInput
              id="min"
              {...(minKobo != null ? { valueKobo: minKobo } : {})}
              onValueChange={setMinKobo}
            />
          </Field>
          <Field id="target" label="Target payoff date" optional>
            <Input
              id="target"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field id="plan-note" label="Note" optional>
            <Textarea
              id="plan-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Agreed terms, who approved, etc."
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
