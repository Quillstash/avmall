"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/money";
import { isValidNigerianPhone } from "@/lib/phone";
import { toast } from "@/components/ui/toaster";

interface OrderHit {
  number: string;
  customerName: string;
  customerPhone: string;
  totalKobo: number;
  status: string;
  createdAt: string;
}

export interface LoadedOrder {
  number: string;
  createdAt: string;
  deliveredAt: string | null;
  /** False for guest / walk-in / POS orders with no linked customer. */
  hasCustomer: boolean;
  customer: { name: string; phone: string; blacklisted: boolean };
  lines: {
    id: string;
    name: string;
    variant: string | null;
    sku: string;
    quantity: number;
    alreadyReturned: number;
    unitKobo: number;
  }[];
}

interface NewReturnClientProps {
  initialNumber: string;
  initialOrder?: LoadedOrder;
  initialError?: string;
}

interface DraftLine {
  orderLineId: string;
  selected: boolean;
  quantity: number;
  condition: "unopened" | "used" | "damaged";
  restock: boolean;
  refundKobo: number;
}

const RETURN_WINDOW_DAYS = 14;

export function NewReturnClient({
  initialNumber,
  initialOrder,
  initialError,
}: NewReturnClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orderInput, setOrderInput] = React.useState(initialNumber);
  const order = initialOrder ?? null;
  const error = initialError ?? null;

  // Debounced order typeahead.
  const [suggestions, setSuggestions] = React.useState<OrderHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [showSuggest, setShowSuggest] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  // Guest/walk-in orders have no customer on file — capture one for the return.
  // Pre-fill from the order's shipping snapshot only when it carries a real
  // phone (storefront guest checkout); walk-in/POS orders use placeholders like
  // "Walk-in", so leave the fields empty for staff to fill. Reset on order change.
  const prefillContact = React.useCallback(
    (o: typeof order): { name: string; phone: string } =>
      o && isValidNigerianPhone(o.customer.phone)
        ? { name: o.customer.name, phone: o.customer.phone }
        : { name: "", phone: "" },
    [],
  );
  const [custName, setCustName] = React.useState(() => prefillContact(order).name);
  const [custPhone, setCustPhone] = React.useState(() => prefillContact(order).phone);
  React.useEffect(() => {
    const c = prefillContact(order);
    setCustName(c.name);
    setCustPhone(c.phone);
  }, [order, prefillContact]);

  // Per-line draft state. Built fresh whenever the order changes.
  const [drafts, setDrafts] = React.useState<DraftLine[]>(() =>
    (order?.lines ?? []).map((l) => ({
      orderLineId: l.id,
      selected: false,
      quantity: 1,
      condition: "unopened",
      restock: true,
      refundKobo: l.unitKobo, // default: one unit's worth
    })),
  );

  // Reset per-line drafts whenever the loaded order changes. Done during render
  // (not in an effect) so `drafts` always matches the order being rendered —
  // otherwise the first render after navigating to a new order reads stale
  // drafts and crashes on drafts[i].
  const [draftsForOrder, setDraftsForOrder] = React.useState<string | null>(
    order?.number ?? null,
  );
  if ((order?.number ?? null) !== draftsForOrder) {
    setDraftsForOrder(order?.number ?? null);
    setDrafts(
      (order?.lines ?? []).map((l) => ({
        orderLineId: l.id,
        selected: false,
        quantity: 1,
        condition: "unopened" as const,
        restock: true,
        refundKobo: l.unitKobo,
      })),
    );
  }

  const [reason, setReason] = React.useState("");
  const [refundMethod, setRefundMethod] = React.useState<"original" | "transfer">(
    "original",
  );
  const [internalNote, setInternalNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  function lookup() {
    const trimmed = orderInput.trim();
    if (!trimmed) return;
    selectOrder(trimmed);
  }

  function selectOrder(number: string) {
    setShowSuggest(false);
    const next = new URLSearchParams(searchParams.toString());
    next.set("order", number);
    router.push(`/admin/returns/new?${next.toString()}`);
  }

  // Fetch suggestions as the operator types (debounced, abortable).
  React.useEffect(() => {
    const q = orderInput.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/orders/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        const json = await res.json();
        if (res.ok) setSuggestions(json.data?.orders ?? []);
      } catch {
        /* user keeps typing */
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [orderInput]);

  // Close the dropdown when clicking outside it.
  React.useEffect(() => {
    if (!showSuggest) return;
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showSuggest]);

  const outsideWindow =
    order?.deliveredAt != null &&
    Date.now() - new Date(order.deliveredAt).getTime() >
      RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const selectedDrafts = drafts.filter((d) => d.selected);
  const totalRefundKobo = selectedDrafts.reduce((a, d) => a + d.refundKobo, 0);

  function patch(idx: number, p: Partial<DraftLine>) {
    setDrafts((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx]!, ...p };
      return next;
    });
  }

  async function submit() {
    if (!order) return;
    if (selectedDrafts.length === 0) {
      toast.error("Select at least one line to return.");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required for every return.");
      return;
    }
    if (!order.hasCustomer && (!custName.trim() || !isValidNigerianPhone(custPhone))) {
      toast.error("Enter the customer's name and a valid Nigerian phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: order.number,
          lines: selectedDrafts.map((d) => ({
            orderLineId: d.orderLineId,
            quantity: d.quantity,
            condition: d.condition,
            restock: d.restock,
            refundKobo: d.refundKobo,
          })),
          reason: reason.trim(),
          refundMethod,
          ...(internalNote.trim() && { internalNote: internalNote.trim() }),
          ...(order.hasCustomer
            ? {}
            : { contact: { name: custName.trim(), phone: custPhone.trim() } }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not create return");
        return;
      }
      const number = json?.data?.return?.number;
      toast.success(`Return ${number} created`);
      router.push(`/admin/returns/${json.data.return.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Returns", href: "/admin/returns" },
          { label: "New return" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1100px] mx-auto pb-20">
          <PageHeader
            title="New return"
            subtitle="Counter return — customer brought the item back in person"
          />

          {/* Order lookup */}
          <Card title="Find the order">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1" ref={searchRef}>
                <div className="flex items-center gap-2 px-3 h-10 rounded-md border border-border-strong bg-surface focus-within:ring-2 focus-within:ring-brand-primary/30">
                  <Search className="size-4 text-fg-muted" />
                  <input
                    value={orderInput}
                    onChange={(e) => {
                      setOrderInput(e.target.value);
                      setShowSuggest(true);
                    }}
                    onFocus={() => setShowSuggest(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        lookup();
                      } else if (e.key === "Escape") {
                        setShowSuggest(false);
                      }
                    }}
                    placeholder="Search by order #, customer name or phone…"
                    className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle outline-none"
                  />
                  {searching && (
                    <Loader2 className="size-3.5 animate-spin text-fg-muted" />
                  )}
                </div>
                {showSuggest && orderInput.trim().length >= 2 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border-strong rounded-md shadow-lg max-h-72 overflow-y-auto">
                    {searching && suggestions.length === 0 ? (
                      <div className="p-3 text-xs text-fg-muted inline-flex items-center gap-2">
                        <Loader2 className="size-3.5 animate-spin" /> Searching…
                      </div>
                    ) : suggestions.length === 0 ? (
                      <div className="p-3 text-xs text-fg-muted">No matching orders</div>
                    ) : (
                      suggestions.map((s) => (
                        <button
                          key={s.number}
                          type="button"
                          onClick={() => selectOrder(s.number)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 text-left border-b border-border last:border-b-0"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold font-mono tabular">#{s.number}</div>
                            <div className="text-[11px] text-fg-muted truncate">
                              {s.customerName} · {s.customerPhone}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold tabular">{formatMoney(s.totalKobo)}</div>
                            <div className="text-[10px] text-fg-muted capitalize">{s.status}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <Button onClick={lookup} disabled={!orderInput.trim()}>
                Look up
              </Button>
            </div>
            {error && (
              <div className="mt-3 p-3 rounded-md bg-danger-bg text-sm text-danger">
                {error}
              </div>
            )}
          </Card>

          {order && (
            <>
              {/* Order summary */}
              <Card title={`Order ${order.number}`}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {order.hasCustomer && (
                    <>
                      <Fact label="Customer" value={order.customer.name} />
                      <Fact
                        label="Phone"
                        value={<span className="font-mono">{order.customer.phone}</span>}
                      />
                    </>
                  )}
                  <Fact
                    label="Order date"
                    value={new Date(order.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Africa/Lagos",
                    })}
                  />
                </div>

                {!order.hasCustomer && (
                  <div className="mt-3 p-3 rounded-md bg-surface-2 border border-border">
                    <div className="flex items-start gap-2 text-xs text-fg-muted mb-3">
                      <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
                      <span>
                        Guest / walk-in order — no customer on file. Add the customer's
                        details to record the return; they&apos;ll be saved and linked to
                        this order.
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field id="cust-name" label="Customer name">
                        <Input
                          id="cust-name"
                          value={custName}
                          onChange={(e) => setCustName(e.target.value)}
                          placeholder="Full name"
                        />
                      </Field>
                      <Field id="cust-phone" label="Phone">
                        <Input
                          id="cust-phone"
                          value={custPhone}
                          onChange={(e) => setCustPhone(e.target.value)}
                          placeholder="+234 803 …"
                        />
                      </Field>
                    </div>
                  </div>
                )}
                {(outsideWindow || order.customer.blacklisted) && (
                  <div className="mt-3 flex flex-col gap-2">
                    {outsideWindow && (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-warning-bg text-warning text-xs">
                        <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
                        <span>
                          Delivered more than {RETURN_WINDOW_DAYS} days ago — outside the
                          standard return window. You can still record this return, but it
                          will be flagged.
                        </span>
                      </div>
                    )}
                    {order.customer.blacklisted && (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-danger-bg text-danger text-xs">
                        <ShieldAlert className="size-4 flex-shrink-0 mt-0.5" />
                        <span>
                          Customer is blacklisted — server will reject this return. Escalate to
                          a manager.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Line picker */}
              <Card title="Returning items">
                <div className="flex flex-col gap-2">
                  {order.lines.map((line, i) => {
                    const draft = drafts[i] ?? {
                      orderLineId: line.id,
                      selected: false,
                      quantity: 1,
                      condition: "unopened" as const,
                      restock: true,
                      refundKobo: line.unitKobo,
                    };
                    const remaining = line.quantity - line.alreadyReturned;
                    const fullyReturned = remaining <= 0;
                    return (
                      <div
                        key={line.id}
                        className={`rounded-md border p-3 ${
                          draft.selected
                            ? "border-brand-primary/40 bg-info-bg/30"
                            : "border-border bg-surface"
                        } ${fullyReturned ? "opacity-50" : ""}`}
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.selected}
                            disabled={fullyReturned}
                            onChange={(e) => patch(i, { selected: e.target.checked })}
                            className="size-4 mt-1 accent-brand-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="font-semibold text-sm truncate">
                                {line.name}
                              </div>
                              <Money
                                kobo={line.unitKobo}
                                className="text-sm font-bold whitespace-nowrap"
                              />
                            </div>
                            <div className="text-[11px] text-fg-muted">
                              {line.variant && <>{line.variant} · </>}
                              <span className="font-mono">{line.sku}</span>
                              {" · "}
                              Ordered {line.quantity}
                              {line.alreadyReturned > 0 && (
                                <span className="text-warning">
                                  {" "}
                                  · {line.alreadyReturned} already returned
                                </span>
                              )}
                              {fullyReturned && (
                                <span className="text-fg-subtle"> · fully returned</span>
                              )}
                            </div>
                          </div>
                        </label>
                        {draft.selected && !fullyReturned && (
                          <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3 pl-7">
                            <Field id={`qty-${i}`} label="Quantity">
                              <Input
                                id={`qty-${i}`}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={remaining}
                                value={draft.quantity}
                                onChange={(e) => {
                                  const q = Math.max(
                                    1,
                                    Math.min(remaining, parseInt(e.target.value || "1", 10)),
                                  );
                                  patch(i, {
                                    quantity: q,
                                    // Re-default refund to unit × qty when qty changes
                                    refundKobo: line.unitKobo * q,
                                  });
                                }}
                              />
                            </Field>
                            <Field id={`cond-${i}`} label="Condition">
                              <Select
                                id={`cond-${i}`}
                                value={draft.condition}
                                onChange={(e) => {
                                  const cond = e.target.value as DraftLine["condition"];
                                  patch(i, {
                                    condition: cond,
                                    // Damaged defaults to no-restock; otherwise keep current
                                    restock: cond === "damaged" ? false : draft.restock,
                                  });
                                }}
                              >
                                <option value="unopened">Unopened</option>
                                <option value="used">Used</option>
                                <option value="damaged">Damaged</option>
                              </Select>
                            </Field>
                            <Field id={`refund-${i}`} label="Refund">
                              <CurrencyInput
                                id={`refund-${i}`}
                                valueKobo={draft.refundKobo}
                                onValueChange={(v) =>
                                  patch(i, { refundKobo: v ?? 0 })
                                }
                              />
                            </Field>
                            <Field id={`restock-${i}`} label="Back to stock">
                              <label className="flex items-center gap-2 h-10">
                                <input
                                  type="checkbox"
                                  checked={draft.restock}
                                  onChange={(e) =>
                                    patch(i, { restock: e.target.checked })
                                  }
                                  className="size-4 accent-brand-primary"
                                />
                                <span className="text-xs text-fg-muted">
                                  {draft.condition === "damaged"
                                    ? "Off by default — write-off"
                                    : "Increments on-hand stock"}
                                </span>
                              </label>
                            </Field>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Reason + refund method */}
              <Card title="Refund details">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field id="method" label="Refund method">
                    <Select
                      id="method"
                      value={refundMethod}
                      onChange={(e) =>
                        setRefundMethod(e.target.value as typeof refundMethod)
                      }
                    >
                      <option value="original">Original payment method</option>
                      <option value="transfer">Bank transfer</option>
                    </Select>
                  </Field>
                  <Field id="reason" label="Reason" required>
                    <Input
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Wrong size, defective unit, changed mind"
                    />
                  </Field>
                  <Field id="note" label="Internal note" className="md:col-span-2">
                    <Textarea
                      id="note"
                      rows={2}
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      placeholder="Visible to staff only"
                    />
                  </Field>
                </div>
              </Card>

              {/* Summary + submit */}
              <div className="sticky bottom-0 mt-4 rounded-lg border border-border bg-surface shadow-md p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="flex-1 text-sm">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    Refund total
                  </div>
                  <Money kobo={totalRefundKobo} className="text-2xl font-bold tabular" />
                </div>
                <div className="text-xs text-fg-muted">
                  {selectedDrafts.length === 0
                    ? "Pick at least one item to return"
                    : `${selectedDrafts.length} ${
                        selectedDrafts.length === 1 ? "item" : "items"
                      } selected`}
                </div>
                <Button
                  size="lg"
                  disabled={submitting || selectedDrafts.length === 0}
                  onClick={submit}
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {submitting ? "Recording…" : "Record return"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm mt-4 first:mt-0">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-bold">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
