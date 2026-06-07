"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, ShoppingBag, Tag, Heart, Bell, Check, Loader2 } from "lucide-react";
import { useWishlist } from "@/stores/wishlist-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PriceBlock } from "@/components/ui/price-block";
import { VariantPicker } from "@/components/ui/variant-picker";
import { useCart } from "@/stores/cart-store";
import { applyPercentageDiscount, formatMoney } from "@/lib/money";
import type { Product } from "@/lib/mock-data";
import { toast } from "@/components/ui/toaster";

export function PDPDetail({ product }: { product: Product }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const cartLines = useCart((s) => s.lines);
  const toggleWishlist = useWishlist((s) => s.toggle);
  const inWishlist = useWishlist((s) => s.has(product.id));

  const defaultVariant =
    product.variants.find((v) => v.stock > 0) ?? product.variants[0]!;
  const [variantId, setVariantId] = React.useState(defaultVariant.id);
  const minQty = product.preorder ? (product.moq ?? 1) : 1;
  const [qty, setQty] = React.useState(minQty);

  const variant = product.variants.find((v) => v.id === variantId) ?? defaultVariant;
  const unitKobo =
    variant.price ?? (product.saleActive && product.sale != null ? product.sale : product.price);

  // Stock guard: cap qty at remaining stock minus whatever the cart already
  // holds for this exact (product, variant) line. Pre-orders are unconstrained
  // by on-hand stock.
  const existingInCart =
    cartLines.find((l) => l.productId === product.id && l.variantId === variantId)?.qty ?? 0;
  const availableStock = Math.max(0, variant.stock - existingInCart);
  const maxAddable = product.preorder ? undefined : availableStock;
  const oos = variant.stock === 0 && !product.preorder;
  const noRoomLeft = !product.preorder && !oos && availableStock === 0;

  // Clamp qty when the user switches to a lower-stock variant (or the cart
  // is mutated elsewhere). Never drop below minQty.
  React.useEffect(() => {
    if (maxAddable != null && qty > maxAddable) {
      setQty(Math.max(minQty, maxAddable));
    }
  }, [maxAddable, qty, minQty]);

  let activeBulk = null as typeof product.bulk[number] | null;
  for (const tier of product.bulk) {
    if (qty >= tier.min && (tier.max == null || qty <= tier.max)) activeBulk = tier;
  }
  const bulkSavings = activeBulk
    ? applyPercentageDiscount(unitKobo * qty, activeBulk.value)
    : 0;
  const lineTotal = unitKobo * qty - bulkSavings;

  function handleAdd() {
    if (oos || noRoomLeft) return;
    if (maxAddable != null && qty > maxAddable) return;
    add(product, variantId, qty);
    toast.success(`${product.name} added to cart`);
    router.push("/cart");
  }

  return (
    <>
      {/* Price block */}
      <div className="mb-6">
        <PriceBlock
          priceKobo={unitKobo}
          {...(product.saleActive && product.sale != null
            ? { comparePriceKobo: product.price, onSale: true }
            : {})}
          size="xl"
        />
        {product.negotiate && (
          <button className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline">
            <MessageCircle className="size-4" /> Negotiate this price on WhatsApp
          </button>
        )}
      </div>

      {/* Variants */}
      {product.variants.length > 1 && (
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">
            Size · <span className="text-fg normal-case font-semibold">{variant.label}</span>
          </div>
          <VariantPicker
            variants={[...product.variants]}
            value={variantId}
            onChange={setVariantId}
          />
        </div>
      )}

      {/* Quantity + stock */}
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">
          Quantity
          {product.preorder && (
            <span className="ml-1 font-medium normal-case text-fg-muted">
              · MOQ {product.moq}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <QuantityStepper
            value={qty}
            onChange={setQty}
            min={minQty}
            {...(maxAddable != null && { max: maxAddable })}
            disabled={oos || noRoomLeft}
          />
          {oos ? (
            <div className="text-sm text-danger font-semibold">Out of stock</div>
          ) : noRoomLeft ? (
            <div className="text-sm text-warning font-semibold">
              All stock already in your cart
            </div>
          ) : !product.preorder && availableStock <= 5 ? (
            <div className="text-sm text-warning font-semibold flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-warning" />
              Only {availableStock} {existingInCart > 0 ? "more " : ""}left
            </div>
          ) : (
            <div className="text-sm text-brand-accent font-semibold flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-brand-accent" />
              In stock — ships in 24h
            </div>
          )}
        </div>
      </div>

      {/* Bulk pricing */}
      {product.bulk.length > 0 && (
        <div className="mb-6 p-4 rounded-md bg-info-bg border border-brand-primary/20">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Tag className="size-4" />
            <div className="text-xs font-bold tracking-wider uppercase">Bulk pricing</div>
          </div>
          <div className="flex flex-col gap-1.5">
            {product.bulk.map((tier, i) => {
              const active = activeBulk === tier;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex justify-between text-sm py-0.5",
                    active ? "font-bold text-brand-primary" : "font-medium text-fg",
                  )}
                >
                  <span>
                    {tier.min}
                    {tier.max ? `–${tier.max}` : "+"} units
                  </span>
                  <span>
                    {tier.value}% off {active && "— applied"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Line total + CTA */}
      <div className="flex flex-col sm:flex-row items-stretch gap-3 mb-6">
        <div className="px-4 py-3 rounded-md border border-border bg-surface-2 flex-shrink-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
            Total
          </div>
          <Money kobo={lineTotal} className="text-xl font-bold" />
          {bulkSavings > 0 && (
            <div className="text-[11px] font-semibold text-brand-accent">
              Saved {formatMoney(bulkSavings)}
            </div>
          )}
        </div>
        {oos ? (
          <RestockNotify slug={product.slug} />
        ) : (
          <Button
            onClick={handleAdd}
            disabled={noRoomLeft}
            size="lg"
            className="flex-1"
          >
            {noRoomLeft
              ? "Already in your cart"
              : product.preorder
                ? "Pre-order"
                : "Add to cart"}
            <ShoppingBag className="size-4" />
          </Button>
        )}
        <Button
          size="lg"
          variant="secondary"
          aria-label={inWishlist ? "Remove from wishlist" : "Save to wishlist"}
          onClick={() => toggleWishlist(product.id)}
          className={cn(inWishlist && "text-danger border-danger/40 bg-danger/5")}
        >
          <Heart className={cn("size-4", inWishlist && "fill-current")} />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="description" className="mt-2">
        <TabsList>
          <TabsTrigger value="description">description</TabsTrigger>
          <TabsTrigger value="shipping">shipping</TabsTrigger>
          <TabsTrigger value="returns">returns</TabsTrigger>
        </TabsList>
        <TabsContent value="description">
          <p className="text-sm text-fg-muted leading-relaxed whitespace-pre-line">
            {product.short ?? "No description available for this product."}
          </p>
        </TabsContent>
        <TabsContent value="shipping">
          <p className="text-sm text-fg-muted leading-relaxed">
            Free shipping in Lagos on orders over ₦25,000. Lagos delivery: 24 hours. Other states:
            2–5 business days. Pickup available at our Ikoyi flagship Mon–Sat 10–7.
          </p>
        </TabsContent>
        <TabsContent value="returns">
          <p className="text-sm text-fg-muted leading-relaxed">
            14-day no-questions returns on unopened items. Refunds processed within 48 hours of
            receipt to your original payment method.
          </p>
        </TabsContent>
      </Tabs>
    </>
  );
}

/**
 * Inline form shown in place of the disabled "Add to cart" button when the
 * selected variant is sold out. Captures an email (preferred — cheaper to
 * notify than SMS) and POSTs to the restock wait-list. Duplicate submits
 * surface the same friendly success message; the server tracks it as
 * alreadySubscribed but we don't expose that to the customer.
 */
function RestockNotify({ slug }: { slug: string }) {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Enter a valid email so we can let you know.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/products/${encodeURIComponent(slug)}/notify-restock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "pdp" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not save your request");
        return;
      }
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex-1 inline-flex items-center gap-2 px-4 py-3 rounded-md bg-success-bg text-success text-sm font-semibold">
        <Check className="size-4" /> We&apos;ll email you when this is back.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex-1 flex flex-col sm:flex-row gap-2">
      <Input
        type="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 min-w-0"
        required
      />
      <Button type="submit" size="lg" disabled={submitting} className="shrink-0">
        {submitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bell className="size-4" />
        )}
        {submitting ? "Saving…" : "Notify me"}
      </Button>
    </form>
  );
}
