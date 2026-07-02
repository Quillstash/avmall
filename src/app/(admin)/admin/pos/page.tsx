"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  ScanLine,
  Check,
  Printer,
  ShoppingBag,
  UserPlus,
  X,
} from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Money } from "@/components/ui/money";
import { ReceiptPrintView } from "@/components/admin/receipt-print-view";
import { toast } from "@/components/ui/toaster";
import { formatMoney } from "@/lib/money";
import { MANUAL_ORDER_SOURCES, DEFAULT_MANUAL_SOURCE, type OrderSource } from "@/lib/order-source";
import { cn } from "@/lib/utils";

interface ProductHit {
  id: string;
  slug: string;
  name: string;
  brand: string;
  imageUrl: string;
  priceKobo: number;
  saleKobo: number | null;
  saleActive: boolean;
  stock: number;
}

interface CartLine {
  slug: string;
  name: string;
  brand: string;
  imageUrl: string;
  unitKobo: number;
  stock: number;
  qty: number;
}

type Method = "cash" | "pos" | "bank_transfer";

interface PayRow {
  method: Method;
  amountKobo: number | null;
  reference: string;
}

const METHODS: { value: Method; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "pos", label: "POS", icon: CreditCard },
  { value: "bank_transfer", label: "Transfer", icon: ArrowLeftRight },
];

interface ReceiptLine {
  name: string;
  variant: string;
  sku: string;
  qty: number;
  unitKobo: number;
  discountKobo: number;
}

interface CompletedSale {
  number: string;
  totalKobo: number;
  paidKobo: number;
  subtotalKobo: number;
  discountKobo: number;
  lines: ReceiptLine[];
  payments: { method: Method; amountKobo: number }[];
  changeKobo: number;
  at: string;
  customerName?: string | null;
  customerPhone?: string | null;
}

export default function AdminPosPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const staffName = session?.user?.name ?? "Staff";

  const [search, setSearch] = React.useState("");
  const [matches, setMatches] = React.useState<ProductHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [discountKobo, setDiscountKobo] = React.useState(0);
  const [source, setSource] = React.useState<OrderSource>(DEFAULT_MANUAL_SOURCE);
  const [payRows, setPayRows] = React.useState<PayRow[]>([]);
  const [placing, setPlacing] = React.useState(false);
  const [completed, setCompleted] = React.useState<CompletedSale | null>(null);
  // Optional walk-in customer — for partial-sale records + receipt printing.
  const [showCustomer, setShowCustomer] = React.useState(false);
  const [custName, setCustName] = React.useState("");
  const [custPhone, setCustPhone] = React.useState("");
  const [custEmail, setCustEmail] = React.useState("");

  const searchRef = React.useRef<HTMLInputElement>(null);

  // Totals (client estimate — the server recomputes authoritatively, incl. any
  // bulk tiers, and the printed receipt uses the server's numbers).
  const subtotal = lines.reduce((a, l) => a + l.unitKobo * l.qty, 0);
  const total = Math.max(0, subtotal - discountKobo);
  const tendered = payRows.reduce((a, p) => a + (p.amountKobo ?? 0), 0);
  const changeKobo = Math.max(0, tendered - total);
  const remaining = total - tendered;
  const nonCashSum = payRows
    .filter((p) => p.method !== "cash")
    .reduce((a, p) => a + (p.amountKobo ?? 0), 0);
  const hasCash = payRows.some((p) => p.method === "cash");
  const changeWithoutCash = changeKobo > 0 && !hasCash;
  const itemCount = lines.reduce((a, l) => a + l.qty, 0);

  // Live product search — debounced 250ms, aborts in-flight requests.
  React.useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/products/search?q=${encodeURIComponent(q)}&limit=8`,
          { signal: controller.signal },
        );
        const json = await res.json();
        if (res.ok) setMatches(json.data.products ?? []);
      } catch {
        // user keeps typing
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [search]);

  function addProduct(hit: ProductHit) {
    const unitKobo =
      hit.saleActive && hit.saleKobo != null ? hit.saleKobo : hit.priceKobo;
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.slug === hit.slug);
      if (idx >= 0) {
        const existing = prev[idx]!;
        const next = [...prev];
        next[idx] = { ...existing, qty: existing.qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          slug: hit.slug,
          name: hit.name,
          brand: hit.brand,
          imageUrl: hit.imageUrl,
          unitKobo,
          stock: hit.stock,
          qty: 1,
        },
      ];
    });
    setSearch("");
    setMatches([]);
    searchRef.current?.focus();
  }

  function setQty(slug: string, qty: number) {
    setLines((prev) =>
      prev.map((l) => (l.slug === slug ? { ...l, qty: Math.max(1, qty) } : l)),
    );
  }

  function removeLine(slug: string) {
    setLines((prev) => prev.filter((l) => l.slug !== slug));
  }

  function addPayRow(method: Method) {
    // Default the new row to whatever's still owed so a one-tap "Cash" rings
    // up the common full-payment case instantly.
    setPayRows((prev) => {
      const owedNow = Math.max(
        0,
        total - prev.reduce((a, p) => a + (p.amountKobo ?? 0), 0),
      );
      return [
        ...prev,
        { method, amountKobo: owedNow > 0 ? owedNow : null, reference: "" },
      ];
    });
  }

  function patchPayRow(idx: number, patch: Partial<PayRow>) {
    setPayRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx]!, ...patch };
      return next;
    });
  }

  function removePayRow(idx: number) {
    setPayRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetSale() {
    setLines([]);
    setDiscountKobo(0);
    setSource(DEFAULT_MANUAL_SOURCE);
    setPayRows([]);
    setSearch("");
    setMatches([]);
    setCompleted(null);
    setShowCustomer(false);
    setCustName("");
    setCustPhone("");
    setCustEmail("");
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  async function completeSale() {
    if (lines.length === 0) return;
    if (nonCashSum > total) {
      toast.error("Card / transfer can't exceed the total — only cash gives change.");
      return;
    }

    // Strip change off cash rows so the recorded ledger sums to what was
    // actually applied to the order (never more than the total).
    let change = changeKobo;
    const recorded = payRows.map((r) => ({
      method: r.method,
      amountKobo: r.amountKobo ?? 0,
      reference: r.reference,
    }));
    for (const r of recorded) {
      if (change <= 0) break;
      if (r.method === "cash") {
        const take = Math.min(change, r.amountKobo);
        r.amountKobo -= take;
        change -= take;
      }
    }
    const payments = recorded
      .filter((r) => r.amountKobo > 0)
      .map((r) => ({
        method: r.method,
        amountKobo: r.amountKobo,
        ...(r.reference.trim() && { reference: r.reference.trim() }),
      }));

    setPlacing(true);
    try {
      const res = await fetch("/api/v1/admin/pos/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productSlug: l.slug, quantity: l.qty })),
          payments,
          manualDiscountKobo: discountKobo,
          source,
          ...(custName.trim() || custPhone.trim()
            ? {
                customer: {
                  ...(custName.trim() && { name: custName.trim() }),
                  ...(custPhone.trim() && { phone: custPhone.trim() }),
                  ...(custEmail.trim() && { email: custEmail.trim() }),
                },
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not complete the sale");
        return;
      }
      const o = json.data.order as Omit<CompletedSale, "payments" | "changeKobo" | "at">;
      const now = new Date().toLocaleString("en-NG", {
        timeZone: "Africa/Lagos",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });
      setCompleted({
        ...o,
        payments: payments.map((p) => ({ method: p.method, amountKobo: p.amountKobo })),
        changeKobo,
        at: now,
      });
      toast.success(`Sale ${o.number} complete`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setPlacing(false);
    }
  }

  // ---- Completed sale: receipt + reset ------------------------------------
  if (completed) {
    return (
      <>
        <div className="print:hidden contents">
          <AdminTopBar breadcrumbs={[{ label: "Register", href: "/admin/pos" }, { label: "Sale complete" }]} />
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 max-w-2xl mx-auto">
              <div className="rounded-xl border border-brand-accent/30 bg-success-bg p-6 text-center">
                <div className="size-14 rounded-full bg-brand-accent/15 text-brand-accent flex items-center justify-center mx-auto mb-3">
                  <Check className="size-7" strokeWidth={2.5} />
                </div>
                <div className="text-sm font-bold uppercase tracking-wider text-brand-accent">
                  Sale complete
                </div>
                <div className="text-3xl font-bold font-mono tracking-tight tabular mt-1">
                  #{completed.number}
                </div>
                <div className="mt-4 inline-flex flex-col items-center">
                  <span className="text-xs text-fg-muted">Total</span>
                  <Money kobo={completed.totalKobo} variant="large" />
                </div>
                {completed.customerName && (
                  <div className="mt-2 text-xs text-fg-muted">
                    {completed.customerName}
                    {completed.customerPhone ? ` · ${completed.customerPhone}` : ""}
                  </div>
                )}
                {completed.paidKobo < completed.totalKobo && (
                  <div className="mt-3 inline-flex flex-col items-center rounded-lg bg-warning-bg border border-warning/30 px-5 py-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-warning">
                      Balance outstanding
                    </span>
                    <span className="text-xl font-bold tabular text-warning">
                      {formatMoney(completed.totalKobo - completed.paidKobo)}
                    </span>
                  </div>
                )}
                {completed.changeKobo > 0 && (
                  <div className="mt-4 rounded-lg bg-surface border border-border px-5 py-3 inline-flex flex-col items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-warning">
                      Change due
                    </span>
                    <span className="text-2xl font-bold tabular text-warning">
                      {formatMoney(completed.changeKobo)}
                    </span>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-fg-muted">
                  {completed.payments.map((p, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-border"
                    >
                      {METHODS.find((m) => m.value === p.method)?.label ?? p.method}
                      <span className="font-semibold text-fg tabular">
                        {formatMoney(p.amountKobo)}
                      </span>
                    </span>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 mt-6">
                  <Button width="full" onClick={() => window.print()}>
                    <Printer className="size-4" /> Print receipt
                  </Button>
                  <Button width="full" variant="secondary" onClick={resetSale}>
                    <Plus className="size-4" /> New sale
                  </Button>
                </div>
                <Link
                  href={`/admin/orders/${completed.number}`}
                  className="inline-block mt-4 text-xs font-semibold text-brand-primary hover:underline"
                >
                  Open order #{completed.number} →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Print-only receipt — becomes the sole visible element on print. */}
        <div className="hidden print:block">
          <ReceiptPrintView
            orderNumber={completed.number}
            placedAt={completed.at}
            customer={{
              name: completed.customerName ?? "Walk-in customer",
              phone: completed.customerPhone ?? "",
            }}
            items={completed.lines}
            totals={{
              subtotalKobo: completed.subtotalKobo,
              discountKobo: completed.discountKobo,
              shippingKobo: 0,
              totalKobo: completed.totalKobo,
              paidKobo: completed.paidKobo,
              outstandingKobo: Math.max(0, completed.totalKobo - completed.paidKobo),
            }}
            staffName={staffName}
          />
        </div>
      </>
    );
  }

  // ---- Register -----------------------------------------------------------
  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Register" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <ScanLine className="size-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Register</h1>
                <p className="text-xs text-fg-muted">Walk-in sale · no customer details needed</p>
              </div>
            </div>
            {lines.length > 0 && (
              <Button variant="ghost" size="sm" onClick={resetSale}>
                <X className="size-3.5" /> Clear
              </Button>
            )}
          </div>

          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] gap-4 items-start">
            {/* LEFT — search + cart */}
            <div className="flex flex-col gap-4 min-w-0">
              <div className="relative z-30">
                <div className="flex items-center gap-2 px-3.5 h-12 rounded-lg border border-border-strong bg-surface shadow-sm focus-within:ring-2 focus-within:ring-brand-primary/30">
                  <Search className="size-4.5 text-fg-muted" />
                  <input
                    ref={searchRef}
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Scan or search a product by name, brand or SKU…"
                    className="flex-1 bg-transparent text-base text-fg placeholder:text-fg-subtle outline-none"
                  />
                  {searching && <Loader2 className="size-4 animate-spin text-fg-muted" />}
                </div>
                {search.trim().length >= 2 && (
                  <div className="absolute top-full z-40 left-0 right-0 mt-1.5 bg-surface border border-border-strong rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    {searching && matches.length === 0 ? (
                      <div className="p-4 text-sm text-fg-muted inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> Searching…
                      </div>
                    ) : matches.length === 0 ? (
                      <div className="p-4 text-sm text-fg-muted">No matches</div>
                    ) : (
                      matches.map((p) => {
                        const price =
                          p.saleActive && p.saleKobo != null ? p.saleKobo : p.priceKobo;
                        return (
                          <button
                            key={p.id}
                            onClick={() => addProduct(p)}
                            disabled={p.stock <= 0}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 text-left disabled:opacity-50 disabled:cursor-not-allowed border-b border-border last:border-b-0"
                          >
                            <div className="relative size-10 rounded-md flex-shrink-0 overflow-hidden bg-surface-2">
                              <Image src={p.imageUrl} alt={p.name} fill sizes="40px" className="object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{p.name}</div>
                              <div className="text-[11px] text-fg-muted">
                                {p.brand} · <Money kobo={price} />
                              </div>
                            </div>
                            <span
                              className={cn(
                                "text-[11px] font-medium",
                                p.stock <= 0 ? "text-danger" : "text-fg-muted",
                              )}
                            >
                              {p.stock <= 0 ? "Out of stock" : `${p.stock} left`}
                            </span>
                            {p.stock > 0 && <Plus className="size-4 text-fg-muted" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Cart */}
              <div className="rounded-lg border border-border bg-surface shadow-sm min-h-[300px]">
                {lines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-20 px-6">
                    <ShoppingBag className="size-8 text-fg-subtle mb-3" />
                    <p className="text-sm font-semibold">No items yet</p>
                    <p className="text-xs text-fg-muted mt-1">
                      Search above and tap a product to ring it up.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {lines.map((l) => {
                      const lowStock = l.stock < l.qty;
                      return (
                        <div key={l.slug} className="flex items-center gap-3 p-3">
                          <div className="relative size-12 rounded-md flex-shrink-0 overflow-hidden bg-surface-2">
                            <Image src={l.imageUrl} alt={l.name} fill sizes="48px" className="object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{l.name}</div>
                            <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-fg-muted">
                              <span>
                                <Money kobo={l.unitKobo} /> each
                              </span>
                              <span aria-hidden>·</span>
                              <Money kobo={l.unitKobo * l.qty} className="font-bold text-fg" />
                              {lowStock && (
                                <span className="text-danger font-semibold">
                                  only {l.stock} left
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="inline-flex items-center border border-border-strong rounded-md flex-shrink-0">
                            <button
                              onClick={() => setQty(l.slug, l.qty - 1)}
                              className="size-8 flex items-center justify-center hover:bg-surface-2"
                              aria-label="Decrease"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-9 text-center text-sm font-bold tabular">{l.qty}</span>
                            <button
                              onClick={() => setQty(l.slug, l.qty + 1)}
                              className="size-8 flex items-center justify-center hover:bg-surface-2"
                              aria-label="Increase"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeLine(l.slug)}
                            className="p-1.5 text-fg-muted hover:text-danger flex-shrink-0"
                            aria-label="Remove"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — totals + payment */}
            <aside className="lg:sticky lg:top-4 self-start flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 pb-2.5 mb-2 border-b border-border">
                  <span className="text-xs font-semibold text-fg-muted">Channel</span>
                  <div className="w-40">
                    <Select
                      aria-label="Sales channel"
                      value={source}
                      onChange={(e) => setSource(e.target.value as OrderSource)}
                    >
                      {MANUAL_ORDER_SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="flex justify-between items-baseline py-1 text-sm">
                  <span className="text-fg-muted">Subtotal</span>
                  <span className="tabular font-semibold">{formatMoney(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="text-fg-muted">Discount</span>
                  <div className="w-28">
                    <CurrencyInput
                      {...(discountKobo > 0 ? { valueKobo: discountKobo } : {})}
                      placeholder="₦0"
                      onValueChange={(v) => setDiscountKobo(v ?? 0)}
                    />
                  </div>
                </div>
                <div className="h-px bg-border my-2.5" />
                <div className="flex justify-between items-baseline py-1">
                  <span className="text-base font-bold">Total</span>
                  <span className="text-2xl font-bold tabular">{formatMoney(total)}</span>
                </div>
                <div className="text-[11px] text-fg-subtle text-right">
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </div>
              </div>

              {/* Payment */}
              <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                <div className="text-sm font-bold mb-3">Payment</div>

                {payRows.length === 0 ? (
                  <p className="text-xs text-fg-muted mb-3">
                    Choose how the customer is paying. Add more than one to split.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5 mb-3">
                    {payRows.map((row, i) => {
                      const isCash = row.method === "cash";
                      const m = METHODS.find((mm) => mm.value === row.method)!;
                      const Icon = m.icon;
                      return (
                        <div
                          key={i}
                          className="rounded-md bg-surface-2 border border-border p-2.5 flex flex-col gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="size-3.5 text-fg-muted flex-shrink-0" />
                            <span className="text-xs font-semibold flex-1 min-w-0 truncate">
                              {m.label}
                            </span>
                            <button
                              onClick={() => removePayRow(i)}
                              className="-m-1 p-1 text-fg-muted hover:text-danger flex-shrink-0"
                              aria-label="Remove payment"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                          <CurrencyInput
                            {...(row.amountKobo != null ? { valueKobo: row.amountKobo } : {})}
                            placeholder={isCash ? "Cash received" : "Amount"}
                            onValueChange={(v) => patchPayRow(i, { amountKobo: v })}
                          />
                          {row.method === "bank_transfer" && (
                            <Input
                              value={row.reference}
                              onChange={(e) => patchPayRow(i, { reference: e.target.value })}
                              placeholder="Reference (optional)"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Optional walk-in customer */}
                {!showCustomer ? (
                  <button
                    type="button"
                    onClick={() => setShowCustomer(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed border-border-strong text-xs font-semibold text-fg-muted hover:border-brand-primary hover:text-brand-primary"
                  >
                    <UserPlus className="size-3.5" /> Add customer (optional)
                  </button>
                ) : (
                  <div className="rounded-md border border-border bg-surface-2/40 p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                        Customer
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomer(false);
                          setCustName("");
                          setCustPhone("");
                          setCustEmail("");
                        }}
                        className="text-fg-muted hover:text-danger"
                        aria-label="Remove customer"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <Input
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="Name"
                    />
                    <Input
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      placeholder="Phone (e.g. 0803 000 0000)"
                      inputMode="tel"
                    />
                    <Input
                      value={custEmail}
                      onChange={(e) => setCustEmail(e.target.value)}
                      placeholder="Email (optional)"
                      type="email"
                    />
                    <p className="text-[10px] text-fg-muted">
                      Recommended for part-payments so the balance is tracked against them.
                    </p>
                  </div>
                )}

                {/* Method pickers */}
                <div className="grid grid-cols-3 gap-2">
                  {METHODS.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.value}
                        onClick={() => addPayRow(m.value)}
                        disabled={lines.length === 0}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-md border border-border-strong hover:border-brand-primary hover:bg-brand-primary/5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Icon className="size-4" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tender summary */}
                {payRows.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-fg-muted">Tendered</span>
                      <span className="tabular font-semibold">{formatMoney(tendered)}</span>
                    </div>
                    {changeKobo > 0 ? (
                      <div className="flex justify-between font-bold text-brand-accent">
                        <span>Change due</span>
                        <span className="tabular">{formatMoney(changeKobo)}</span>
                      </div>
                    ) : remaining > 0 ? (
                      <div className="flex justify-between font-bold text-warning">
                        <span>Balance</span>
                        <span className="tabular">{formatMoney(remaining)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between font-bold text-brand-accent">
                        <span>Paid in full</span>
                        <Check className="size-4" />
                      </div>
                    )}
                  </div>
                )}

                {changeWithoutCash && (
                  <div className="mt-3 text-xs text-danger bg-danger-bg p-2.5 rounded-md">
                    Only cash can give change — reduce the card / transfer amount.
                  </div>
                )}
                {remaining > 0 && payRows.length > 0 && !changeWithoutCash && (
                  <div className="mt-3 text-xs text-warning bg-warning-bg p-2.5 rounded-md">
                    {formatMoney(remaining)} will be left outstanding on this sale.
                  </div>
                )}
              </div>

              <Button
                width="full"
                size="lg"
                disabled={lines.length === 0 || placing || changeWithoutCash}
                onClick={completeSale}
              >
                {placing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Completing…
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> Complete sale · {formatMoney(total)}
                  </>
                )}
              </Button>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
