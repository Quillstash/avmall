"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Shield, X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { EmptyState } from "@/components/ui/empty-state";
import { CouponInput } from "@/components/ui/coupon-input";
import { useCart, resolveCart, computeTotals, type CartLine } from "@/stores/cart-store";
import { cn } from "@/lib/utils";

/**
 * Decode the AI deeplink payload (?cart=<base64url JSON>). Returns null on
 * any parse / shape failure — we never want a malformed param to crash the
 * cart page or inject garbage lines.
 */
function decodeCartParam(raw: string | null): CartLine[] | null {
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const lines: CartLine[] = [];
    for (const item of parsed) {
      if (
        typeof item?.productId === "string" &&
        typeof item?.variantId === "string" &&
        typeof item?.qty === "number" &&
        item.qty > 0 &&
        item.snapshot &&
        typeof item.snapshot.slug === "string" &&
        typeof item.snapshot.unitKobo === "number"
      ) {
        lines.push(item as CartLine);
      }
    }
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}

const SHIPPING_KOBO = 0; // Free over ₦25k in Lagos for mocks

export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const addLines = useCart((s) => s.addLines);

  // AI deeplink: ?cart=<base64url JSON of CartLine[]>. Merge into the existing
  // cart on first paint, then strip the param so a refresh doesn't re-add.
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const param = url.searchParams.get("cart");
    if (!param) return;
    const incoming = decodeCartParam(param);
    if (incoming) addLines(incoming);
    url.searchParams.delete("cart");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }, [addLines]);

  const resolved = React.useMemo(() => resolveCart(lines), [lines]);

  const [coupon, setCoupon] = React.useState<string | null>(null);
  const couponPct = coupon === "WELCOME10" ? 10 : 0;

  const totals = computeTotals(resolved, {
    couponPct,
    shippingKobo: SHIPPING_KOBO,
  });

  if (resolved.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-16">
        <EmptyState
          icon={<ShoppingBag className="size-8" />}
          title="Your cart is empty"
          description="Browse our newest arrivals to find something you'll love."
          action={
            <Link href="/">
              <Button size="lg">Start shopping</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6 lg:py-10">
      <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight mb-2">
        Your cart
      </h1>
      <p className="text-sm text-fg-muted mb-8">
        {totals.itemCount} {totals.itemCount === 1 ? "item" : "items"}
      </p>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12">
        {/* Items */}
        <div className="flex flex-col">
          <div className="hidden lg:grid grid-cols-[1fr_120px_140px_140px_40px] gap-4 pb-3 border-b border-border text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            <span>Product</span>
            <span className="text-center">Quantity</span>
            <span className="text-right">Unit</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          {resolved.map((line) => (
            <div
              key={`${line.productId}-${line.variantId}`}
              className="grid grid-cols-[88px_1fr_auto] lg:grid-cols-[88px_1fr_120px_140px_140px_40px] gap-3 lg:gap-4 py-5 border-b border-border items-center"
            >
              <Link
                href={`/product/${line.snapshot.slug}`}
                className="relative size-22 w-22 h-22 lg:size-20 lg:w-20 lg:h-20 rounded-md overflow-hidden bg-surface-2"
                style={{ background: line.snapshot.bg }}
              >
                {line.snapshot.imageUrl && (
                  <Image
                    src={line.snapshot.imageUrl}
                    alt={line.snapshot.name}
                    fill
                    sizes="88px"
                    className="object-cover"
                  />
                )}
              </Link>

              <div className="min-w-0 col-start-2 lg:col-auto">
                <Link
                  href={`/product/${line.snapshot.slug}`}
                  className="text-sm lg:text-base font-semibold leading-snug line-clamp-2 hover:text-brand-primary"
                >
                  {line.snapshot.name}
                </Link>
                <div className="text-xs text-fg-muted mt-0.5">
                  {line.snapshot.variantLabel} · {line.snapshot.brand}
                </div>
                {line.bulkLabel && (
                  <div className="text-xs font-semibold text-brand-accent mt-1">
                    ✓ {line.bulkLabel} applied
                  </div>
                )}

                {/* Mobile: qty/total row inline */}
                <div className="flex lg:hidden items-center justify-between mt-3">
                  <QuantityStepper
                    value={line.qty}
                    onChange={(q) => setQty(line.productId, line.variantId, q)}
                    size="sm"
                    {...(line.snapshot.stock != null && { max: line.snapshot.stock })}
                  />
                  <div className="text-right">
                    <Money kobo={line.lineTotalKobo} className="text-sm font-bold" />
                    {line.bulkDiscountKobo > 0 && (
                      <Money
                        kobo={line.lineSubtotalKobo}
                        variant="strikethrough"
                        className="block text-[11px]"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop quantity */}
              <div className="hidden lg:flex justify-center">
                <QuantityStepper
                  value={line.qty}
                  onChange={(q) => setQty(line.productId, line.variantId, q)}
                  size="sm"
                  {...(line.snapshot.stock != null && { max: line.snapshot.stock })}
                />
              </div>

              {/* Desktop unit */}
              <div className="hidden lg:block text-right">
                <Money kobo={line.snapshot.unitKobo} className="text-sm font-semibold" />
              </div>

              {/* Desktop total */}
              <div className="hidden lg:block text-right">
                <Money kobo={line.lineTotalKobo} className="text-sm font-bold" />
                {line.bulkDiscountKobo > 0 && (
                  <Money
                    kobo={line.lineSubtotalKobo}
                    variant="strikethrough"
                    className="block text-xs"
                  />
                )}
              </div>

              {/* Remove */}
              <button
                onClick={() => remove(line.productId, line.variantId)}
                className="self-start lg:self-center justify-self-end p-1.5 text-fg-subtle hover:text-danger transition-colors"
                aria-label="Remove"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}

          <div className="mt-6">
            <Link href="/">
              <Button variant="ghost" size="sm">
                ← Continue shopping
              </Button>
            </Link>
          </div>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-28 self-start">
          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <h2 className="font-bold text-base mb-4">Order summary</h2>

            <CouponInput
              value={coupon}
              onApply={setCoupon}
              onRemove={() => setCoupon(null)}
              hint={
                <>
                  Try <code className="font-mono">WELCOME10</code> for 10% off
                </>
              }
              className="mb-4"
            />

            <SummaryRow label="Subtotal" value={<Money kobo={totals.subtotalKobo} />} />
            {totals.bulkDiscountKobo > 0 && (
              <SummaryRow
                label="Bulk discount"
                value={
                  <span className="text-brand-accent inline-flex items-baseline">
                    −<Money kobo={totals.bulkDiscountKobo} className="text-brand-accent" />
                  </span>
                }
              />
            )}
            {totals.couponDiscountKobo > 0 && (
              <SummaryRow
                label="Coupon"
                value={
                  <span className="text-brand-accent inline-flex items-baseline">
                    −<Money kobo={totals.couponDiscountKobo} className="text-brand-accent" />
                  </span>
                }
              />
            )}
            <SummaryRow
              label="Shipping"
              value={
                totals.shippingKobo === 0 ? (
                  <span className="text-brand-accent font-bold">Free</span>
                ) : (
                  <Money kobo={totals.shippingKobo} />
                )
              }
            />
            <div className="h-px bg-border my-3" />
            <SummaryRow label="Total" value={<Money kobo={totals.totalKobo} />} strong />

            <Link href="/checkout" className="block mt-5">
              <Button width="full" size="lg">
                <Lock className="size-4" /> Checkout
              </Button>
            </Link>

            <div className="flex items-center gap-2 justify-center mt-3 text-xs text-fg-muted">
              <Shield className="size-3" /> Secure checkout via Nuqood · 256-bit SSL
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between py-1",
        strong ? "text-base font-bold" : "text-sm",
      )}
    >
      <span className={strong ? "text-fg" : "text-fg-muted"}>{label}</span>
      <span className={cn("tabular", strong ? "font-bold" : "font-semibold")}>{value}</span>
    </div>
  );
}
