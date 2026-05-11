"use client";

import * as React from "react";
import { Search, Plus, Minus, X, Trash2 } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/ui/money";
import { Money as MoneyComp } from "@/components/ui/money";
import { PRODUCTS, NIGERIAN_STATES, LAGOS_LGAS } from "@/lib/mock-data";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

interface DraftLine {
  productId: string;
  variantId: string;
  qty: number;
}

export default function AdminCreateOrderPage() {
  const [search, setSearch] = React.useState("");
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [discountKobo, setDiscountKobo] = React.useState(0);

  const matches = PRODUCTS.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.brand.toLowerCase().includes(search.toLowerCase()),
  ).slice(0, 6);

  const resolved = lines.flatMap((l) => {
    const p = PRODUCTS.find((p) => p.id === l.productId);
    if (!p) return [];
    const v = p.variants.find((v) => v.id === l.variantId);
    if (!v) return [];
    const unit = v.price ?? (p.saleActive && p.sale != null ? p.sale : p.price);
    return [{ ...l, product: p, variant: v, unitKobo: unit, totalKobo: unit * l.qty }];
  });

  const subtotal = resolved.reduce((a, l) => a + l.totalKobo, 0);
  const shipping = 0;
  const total = subtotal - discountKobo + shipping;

  function addProduct(productId: string) {
    const p = PRODUCTS.find((p) => p.id === productId);
    if (!p) return;
    const v = p.variants.find((v) => v.stock > 0) ?? p.variants[0]!;
    setLines((prev) => {
      const idx = prev.findIndex(
        (l) => l.productId === productId && l.variantId === v.id,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, qty: next[idx]!.qty + 1 };
        return next;
      }
      return [...prev, { productId, variantId: v.id, qty: 1 }];
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
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Create order"
            subtitle="Manual order — walk-in, phone, or staff-created"
            actions={
              <>
                <Button variant="ghost" size="sm">
                  Save as draft
                </Button>
                <Button size="sm" disabled={resolved.length === 0}>
                  Place order
                </Button>
              </>
            }
          />

          <div className="grid lg:grid-cols-[1fr_360px] gap-4">
            {/* Left — order body */}
            <div className="flex flex-col gap-4">
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
                      {matches.length === 0 ? (
                        <div className="p-4 text-xs text-fg-muted">No matches</div>
                      ) : (
                        matches.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => addProduct(p.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 text-left"
                          >
                            <div
                              className="size-9 rounded-md flex-shrink-0"
                              style={{ background: p.bg }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{p.name}</div>
                              <div className="text-[11px] text-fg-muted">
                                {p.brand} ·{" "}
                                <Money kobo={p.saleActive && p.sale != null ? p.sale : p.price} />
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
                        key={`${l.productId}-${l.variantId}`}
                        className="flex items-center gap-3 py-3 border-t border-border first:border-t-0"
                      >
                        <div
                          className="size-12 rounded-md flex-shrink-0"
                          style={{ background: l.product.bg }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{l.product.name}</div>
                          <div className="text-[11px] text-fg-muted">
                            {l.variant.label} · <Money kobo={l.unitKobo} /> each
                          </div>
                        </div>
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
                        <Money kobo={l.totalKobo} className="font-bold text-sm w-24 text-right" />
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
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Customer">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field id="name" label="Recipient name">
                    <Input id="name" defaultValue="Walk-in customer" />
                  </Field>
                  <Field id="phone" label="Phone number">
                    <PhoneInput id="phone" placeholder="803 421 7790" />
                  </Field>
                </div>
              </Card>

              <Card title="Delivery address">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field id="state" label="State">
                    <Select id="state" defaultValue="Lagos">
                      {NIGERIAN_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="lga" label="LGA">
                    <Select id="lga" defaultValue="Ikoyi">
                      {LAGOS_LGAS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="address" label="Street address" className="md:col-span-2">
                    <Textarea id="address" rows={2} placeholder="House number, street…" />
                  </Field>
                </div>
              </Card>

              <Card title="Notes (internal)">
                <Textarea placeholder="Anything the team should know…" rows={2} />
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
                  <Button width="full" disabled={resolved.length === 0}>
                    Place order
                  </Button>
                  <Button width="full" variant="ghost" size="sm">
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
