"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Plus, Minus, Trash2, Loader2 } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/ui/money";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "@/components/ui/toaster";
import { NIGERIAN_STATES } from "@/lib/mock-data";
import { NIGERIA_LGAS } from "@/lib/nigeria-lgas";
import { formatMoney } from "@/lib/money";
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

interface DraftLine {
  slug: string;
  name: string;
  brand: string;
  imageUrl: string;
  unitKobo: number;
  stock: number;
  qty: number;
}

export default function AdminCreateOrderPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [discountKobo, setDiscountKobo] = React.useState(0);
  const [recipientName, setRecipientName] = React.useState("Walk-in customer");
  const [phone, setPhone] = React.useState("");
  const [state, setState] = React.useState("Lagos");
  const [lga, setLga] = React.useState(NIGERIA_LGAS["Lagos"]?.[0] ?? "");
  const [line1, setLine1] = React.useState("Walk-in (in-store)");
  const [notes, setNotes] = React.useState("");
  const [placing, setPlacing] = React.useState(false);

  // Split-payment rows captured at the counter. Each row gets recorded as a
  // separate OrderPayment after the order is created. Empty list = unpaid.
  type PaymentMethod = "cash" | "pos" | "bank_transfer" | "nuqood";
  interface PaymentRow {
    method: PaymentMethod;
    amountKobo: number | null;
    reference: string;
  }
  const [paymentRows, setPaymentRows] = React.useState<PaymentRow[]>([]);

  function addPaymentRow() {
    // Default the new row's amount to whatever's still outstanding.
    const sumSoFar = paymentRows.reduce((a, p) => a + (p.amountKobo ?? 0), 0);
    const remaining = Math.max(0, total - sumSoFar);
    setPaymentRows((prev) => [
      ...prev,
      { method: "cash", amountKobo: remaining > 0 ? remaining : null, reference: "" },
    ]);
  }
  function patchPaymentRow(idx: number, patch: Partial<PaymentRow>) {
    setPaymentRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx]!, ...patch };
      return next;
    });
  }
  function removePaymentRow(idx: number) {
    setPaymentRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function placeOrder() {
    if (resolved.length === 0) return;
    if (!recipientName.trim()) {
      toast.error("Recipient name is required.");
      return;
    }
    const paidNow = paymentRows.reduce((a, p) => a + (p.amountKobo ?? 0), 0);
    if (paidNow > total) {
      toast.error(
        `Payments total ${formatMoney(paidNow - total)} more than the order. Reduce a row before saving.`,
      );
      return;
    }
    setPlacing(true);
    try {
      const res = await fetch("/api/v1/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: resolved.map((l) => ({
            productSlug: l.slug,
            quantity: l.qty,
          })),
          contact: {
            name: recipientName.trim(),
            ...(phone.trim() && { phone: phone.trim() }),
          },
          shipping: {
            ...(line1.trim() && { line1: line1.trim() }),
            city: lga,
            state,
          },
          manualDiscountKobo: discountKobo,
          source: "walkin",
          ...(notes.trim() && { customerNote: notes.trim() }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Could not place order";
        toast.error(msg);
        return;
      }
      const number = json?.data?.order?.number;

      // Record each payment row in sequence. Any failure here leaves the
      // order in place — staff can finish up from the order detail page.
      const rowsToRecord = paymentRows.filter((p) => (p.amountKobo ?? 0) > 0);
      if (rowsToRecord.length > 0 && number) {
        for (const row of rowsToRecord) {
          const payRes = await fetch(
            `/api/v1/admin/orders/${encodeURIComponent(number)}/payments`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amountKobo: row.amountKobo,
                method: row.method,
                ...(row.reference.trim() && { reference: row.reference.trim() }),
              }),
            },
          );
          if (!payRes.ok) {
            const payJson = await payRes.json();
            toast.error(
              `Order ${number} created but a payment couldn't be recorded: ${payJson?.error?.message ?? "Unknown error"}. Finish on the order page.`,
            );
            router.push(`/admin/orders/${number}`);
            return;
          }
        }
      }

      toast.success(`Order ${number} created`);
      router.push(`/admin/orders/${number}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      toast.error(msg);
    } finally {
      setPlacing(false);
    }
  }

  const [matches, setMatches] = React.useState<ProductHit[]>([]);
  const [searching, setSearching] = React.useState(false);

  // Live product search against the DB. Debounced 250ms; aborts in-flight
  // requests when the search box keeps changing. Empty/short queries clear.
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
          `/api/v1/admin/products/search?q=${encodeURIComponent(q)}&limit=6`,
          { signal: controller.signal },
        );
        const json = await res.json();
        if (res.ok) setMatches(json.data.products ?? []);
      } catch {
        // ignore; user keeps typing
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [search]);

  const resolved = lines.map((l) => ({
    ...l,
    totalKobo: l.unitKobo * l.qty,
  }));

  const subtotal = resolved.reduce((a, l) => a + l.totalKobo, 0);
  const shipping = 0;
  const total = subtotal - discountKobo + shipping;

  function addProduct(hit: ProductHit) {
    const unitKobo =
      hit.saleActive && hit.saleKobo != null ? hit.saleKobo : hit.priceKobo;
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.slug === hit.slug);
      if (idx >= 0) {
        const existing = prev[idx]!;
        const next = [...prev];
        next[idx] = {
          ...existing,
          qty: Math.min(existing.qty + 1, Math.max(1, hit.stock)),
        };
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
  }

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Orders", href: "/admin/orders" },
          { label: "New order" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Create order"
            subtitle="Manual order — walk-in, phone, or staff-created"
            actions={
              <>
                <Button variant="ghost" size="sm">
                  Save as draft
                </Button>
                <Button
                  size="sm"
                  disabled={resolved.length === 0 || placing}
                  onClick={placeOrder}
                >
                  {placing && <Loader2 className="size-4 animate-spin" />}
                  {placing ? "Placing…" : "Place order"}
                </Button>
              </>
            }
          />

          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
            {/* Left — order body */}
            <div className="flex flex-col gap-4 min-w-0">
              {/* Product picker */}
              <Card title="Items">
                <div className="relative">
                  <div className="flex items-center gap-2 px-3 h-10 rounded-md border border-border-strong bg-surface">
                    <Search className="size-4 text-fg-muted" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search products by name, brand or SKU…"
                      className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle outline-none"
                    />
                  </div>
                  {search && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-surface border border-border-strong rounded-md shadow-lg max-h-72 overflow-y-auto">
                      {searching ? (
                        <div className="p-4 text-xs text-fg-muted inline-flex items-center gap-2">
                          <Loader2 className="size-3.5 animate-spin" /> Searching…
                        </div>
                      ) : matches.length === 0 ? (
                        <div className="p-4 text-xs text-fg-muted">No matches</div>
                      ) : (
                        matches.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => addProduct(p)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 text-left"
                          >
                            <div className="relative size-9 rounded-md flex-shrink-0 overflow-hidden bg-surface-2">
                              <Image
                                src={p.imageUrl}
                                alt={p.name}
                                fill
                                sizes="36px"
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{p.name}</div>
                              <div className="text-[11px] text-fg-muted">
                                {p.brand} ·{" "}
                                <Money
                                  kobo={
                                    p.saleActive && p.saleKobo != null
                                      ? p.saleKobo
                                      : p.priceKobo
                                  }
                                />
                                {p.stock === 0 && (
                                  <span className="ml-2 text-danger">Out of stock</span>
                                )}
                              </div>
                            </div>
                            <Plus className="size-4 text-fg-muted" />
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Lines */}
                {resolved.length === 0 ? (
                  <div className="mt-5 py-8 text-center text-sm text-fg-muted border border-dashed border-border rounded-md">
                    Search and add products to start an order
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col">
                    {resolved.map((l, i) => (
                      <div
                        key={l.slug}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2.5 py-3 border-t border-border first:border-t-0"
                      >
                        <div className="relative size-12 rounded-md flex-shrink-0 overflow-hidden bg-surface-2">
                          <Image
                            src={l.imageUrl}
                            alt={l.name}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{l.name}</div>
                          <div className="text-[11px] text-fg-muted">
                            {l.brand} · <Money kobo={l.unitKobo} /> each ·{" "}
                            <span className={l.stock < l.qty ? "text-danger" : ""}>
                              {l.stock} in stock
                            </span>
                          </div>
                        </div>
                        {/* Controls wrap to their own full-width row on mobile, sit
                            inline on tablet/desktop. */}
                        <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
                          <div className="inline-flex items-center border border-border-strong rounded-md">
                            <button
                              onClick={() =>
                                setLines((prev) => {
                                  const next = [...prev];
                                  next[i] = { ...next[i]!, qty: Math.max(1, next[i]!.qty - 1) };
                                  return next;
                                })
                              }
                              className="size-8 flex items-center justify-center hover:bg-surface-2"
                              aria-label="Decrease"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-10 text-center text-sm font-semibold tabular">
                              {l.qty}
                            </span>
                            <button
                              onClick={() =>
                                setLines((prev) => {
                                  const next = [...prev];
                                  next[i] = { ...next[i]!, qty: next[i]!.qty + 1 };
                                  return next;
                                })
                              }
                              className="size-8 flex items-center justify-center hover:bg-surface-2"
                              aria-label="Increase"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <Money
                              kobo={l.totalKobo}
                              className="font-bold text-sm text-right sm:w-24"
                            />
                            <button
                              onClick={() =>
                                setLines((prev) => prev.filter((_, idx) => idx !== i))
                              }
                              className="p-1.5 text-fg-muted hover:text-danger"
                              aria-label="Remove"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Customer">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field id="name" label="Recipient name">
                    <Input
                      id="name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </Field>
                  <Field id="phone" label="Phone number (optional)">
                    <PhoneInput
                      id="phone"
                      placeholder="Skip for walk-in"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </Field>
                </div>
              </Card>

              <Card title="Delivery address (optional for walk-ins)">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field id="state" label="State">
                    <Select
                      id="state"
                      value={state}
                      onChange={(e) => {
                        const s = e.target.value;
                        setState(s);
                        // Reset the LGA to match the newly selected state.
                        setLga(NIGERIA_LGAS[s]?.[0] ?? "");
                      }}
                    >
                      {NIGERIAN_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="lga" label="LGA">
                    <Select
                      id="lga"
                      value={lga}
                      onChange={(e) => setLga(e.target.value)}
                    >
                      {(NIGERIA_LGAS[state] ?? []).map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="address" label="Street address" className="md:col-span-2">
                    <Textarea
                      id="address"
                      rows={2}
                      placeholder="House number, street…"
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                    />
                  </Field>
                </div>
              </Card>

              {(() => {
                const paidNow = paymentRows.reduce(
                  (a, p) => a + (p.amountKobo ?? 0),
                  0,
                );
                const overpaid = paidNow > total;
                const remaining = total - paidNow;
                return (
                  <Card title="Payment">
                    {paymentRows.length === 0 ? (
                      <div className="text-center py-3 border border-dashed border-border rounded-md text-sm text-fg-muted">
                        Order will be saved as <span className="font-semibold">unpaid</span>.
                        Add one or more payments now, or record them later.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {paymentRows.map((row, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end p-2.5 rounded-md bg-surface-2 border border-border"
                          >
                            <Field id={`pm-${i}`} label={`Method ${i + 1}`}>
                              <Select
                                id={`pm-${i}`}
                                value={row.method}
                                onChange={(e) =>
                                  patchPaymentRow(i, {
                                    method: e.target.value as PaymentMethod,
                                  })
                                }
                              >
                                <option value="cash">Cash</option>
                                <option value="pos">POS (card on-site)</option>
                                <option value="bank_transfer">Bank transfer</option>
                                <option value="nuqood">Nuqood</option>
                              </Select>
                            </Field>
                            <Field id={`pa-${i}`} label="Amount">
                              <CurrencyInput
                                id={`pa-${i}`}
                                {...(row.amountKobo != null
                                  ? { valueKobo: row.amountKobo }
                                  : {})}
                                onValueChange={(v) =>
                                  patchPaymentRow(i, { amountKobo: v })
                                }
                              />
                            </Field>
                            <button
                              type="button"
                              onClick={() => removePaymentRow(i)}
                              className="p-2 text-fg-muted hover:text-danger rounded-md hover:bg-surface"
                              aria-label="Remove payment"
                            >
                              <Trash2 className="size-4" />
                            </button>
                            {(row.method === "bank_transfer" ||
                              row.method === "nuqood") && (
                              <Field
                                id={`pr-${i}`}
                                label="Reference"
                                className="md:col-span-3"
                                hint="Optional — txn ID or sender name"
                              >
                                <Input
                                  id={`pr-${i}`}
                                  value={row.reference}
                                  onChange={(e) =>
                                    patchPaymentRow(i, { reference: e.target.value })
                                  }
                                />
                              </Field>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={addPaymentRow}
                      >
                        <Plus className="size-3.5" /> Add payment
                      </Button>
                      {paymentRows.length > 0 && (
                        <div className="text-xs">
                          <span className="text-fg-muted">Paid now: </span>
                          <span className="font-bold tabular">
                            {formatMoney(paidNow)}
                          </span>
                          <span className="text-fg-muted"> / {formatMoney(total)}</span>
                        </div>
                      )}
                    </div>

                    {overpaid && (
                      <div className="mt-3 text-xs text-danger bg-danger-bg p-2.5 rounded-md">
                        Payments total {formatMoney(paidNow - total)} more than the order.
                        Reduce a row before saving.
                      </div>
                    )}
                    {!overpaid && remaining > 0 && paymentRows.length > 0 && (
                      <div className="mt-3 text-xs text-warning bg-warning-bg p-2.5 rounded-md">
                        Partial payment — {formatMoney(remaining)} will be outstanding.
                      </div>
                    )}
                    {!overpaid && remaining === 0 && paymentRows.length > 0 && (
                      <div className="mt-3 text-xs text-brand-accent bg-success-bg p-2.5 rounded-md">
                        Paid in full. The order will move to confirmed automatically.
                      </div>
                    )}
                  </Card>
                );
              })()}

              <Card title="Notes (internal)">
                <Textarea
                  placeholder="Anything the team should know…"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Card>
            </div>

            {/* Right — summary */}
            <aside className="lg:sticky lg:top-6 self-start">
              <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                <h3 className="text-sm font-bold mb-3">Order summary</h3>

                <SummaryRow label="Subtotal" value={formatMoney(subtotal)} />
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="text-fg-muted">Manual discount</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="₦0"
                    onChange={(e) => {
                      try {
                        const n = parseFloat(e.target.value.replace(/[^\d.]/g, ""));
                        if (!isNaN(n)) setDiscountKobo(Math.round(n * 100));
                      } catch {}
                    }}
                    className="text-right text-sm font-semibold bg-surface-2 rounded-sm px-1.5 py-0.5 w-24 tabular outline-none focus:bg-warning-bg"
                  />
                </div>
                <SummaryRow label="Shipping" value={formatMoney(shipping)} />
                <div className="h-px bg-border my-2.5" />
                <SummaryRow label="Total" value={formatMoney(total)} strong />

                <div className="flex flex-col gap-2 mt-4">
                  <Button
                    width="full"
                    disabled={resolved.length === 0 || placing}
                    onClick={placeOrder}
                  >
                    {placing && <Loader2 className="size-4 animate-spin" />}
                    {placing ? "Placing…" : "Place order"}
                  </Button>
                  <Button width="full" variant="ghost" size="sm" disabled>
                    Place + send payment link
                  </Button>
                </div>

                {discountKobo > subtotal && (
                  <div className="mt-3 text-[11px] text-warning bg-warning-bg p-2 rounded-md">
                    Discount exceeds subtotal — server will cap at total.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-bold">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        "flex justify-between items-baseline py-1",
        strong ? "text-base font-bold" : "text-sm",
      )}
    >
      <span className={strong ? "text-fg" : "text-fg-muted"}>{label}</span>
      <span className={cn("tabular", strong ? "font-bold" : "font-semibold")}>{value}</span>
    </div>
  );
}
