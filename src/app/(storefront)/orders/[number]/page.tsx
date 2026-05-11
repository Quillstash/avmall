"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, MapPin, Truck, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderStatusPill } from "@/components/ui/status-pill";
import { Money } from "@/components/ui/money";
import { useCart, resolveCart, computeTotals } from "@/stores/cart-store";
import { cn } from "@/lib/utils";

interface Step {
  t: string;
  s: string;
  done: boolean;
  current?: boolean;
}

const STEPS: Step[] = [
  { t: "Order placed", s: "2:14 PM today", done: true, current: true },
  { t: "Confirmed", s: "pending", done: false },
  { t: "Shipped", s: "", done: false },
  { t: "Delivered", s: "", done: false },
];

interface PageProps {
  params: { number: string };
}

export default function OrderConfirmationPage({ params }: PageProps) {
  const lines = useCart((s) => s.lines);
  const resolved = React.useMemo(() => resolveCart(lines), [lines]);
  const totals = computeTotals(resolved, { shippingKobo: 0 });

  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 py-10 lg:py-16">
      <div className="text-center mb-10">
        <div className="size-16 mx-auto mb-5 rounded-full bg-brand-accent flex items-center justify-center text-white">
          <Check className="size-8" strokeWidth={3} />
        </div>
        <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight mb-2">
          Thanks, Tolu — your order is confirmed.
        </h1>
        <p className="text-sm text-fg-muted">
          A receipt has been sent to your phone. We&apos;ll text you again when it ships.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 lg:gap-8">
        {/* Main */}
        <div className="flex flex-col gap-5">
          {/* Order ref card */}
          <div className="rounded-lg border border-border bg-surface p-5 lg:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-fg-muted">
                Order number
              </div>
              <div className="font-mono font-bold text-lg tabular mt-0.5">#{params.number}</div>
            </div>
            <OrderStatusPill status="confirmed" />
          </div>

          {/* Items */}
          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="px-5 lg:px-6 py-4 border-b border-border">
              <div className="text-sm font-bold">Items</div>
            </div>
            <div className="divide-y divide-border">
              {resolved.map((l) => (
                <div
                  key={`${l.productId}-${l.variantId}`}
                  className="flex items-center gap-3 px-5 lg:px-6 py-4"
                >
                  <div
                    className="relative size-14 flex-shrink-0 rounded-md overflow-hidden"
                    style={{ background: l.product.bg }}
                  >
                    <Image
                      src={l.product.imageUrl}
                      alt={l.product.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold leading-snug">{l.product.name}</div>
                    <div className="text-xs text-fg-muted">
                      {l.variant.label} · qty {l.qty}
                    </div>
                  </div>
                  <Money kobo={l.lineTotalKobo} className="font-semibold" />
                </div>
              ))}
            </div>
            <div className="px-5 lg:px-6 py-4 border-t border-border bg-surface-2 flex justify-between text-base font-bold">
              <span>Total</span>
              <Money kobo={totals.totalKobo} />
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-border bg-surface p-5 lg:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="size-4" />
              <div className="font-bold text-sm">Estimated delivery: tomorrow by 6pm</div>
            </div>
            <div className="relative pl-1">
              <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-border" />
              {STEPS.map((step, i) => (
                <div key={i} className="relative flex items-center gap-3.5 py-2">
                  <div
                    className={cn(
                      "size-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 text-white",
                      step.done ? "bg-brand-accent" : "bg-surface border-2 border-border",
                    )}
                  >
                    {step.done && <Check className="size-3" strokeWidth={3} />}
                  </div>
                  <div>
                    <div
                      className={cn(
                        "text-sm",
                        step.current ? "font-bold" : "font-medium",
                        step.done ? "text-fg" : "text-fg-muted",
                      )}
                    >
                      {step.t}
                    </div>
                    {step.s && <div className="text-xs text-fg-subtle">{step.s}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">
              <MapPin className="size-3.5" /> Shipping to
            </div>
            <div className="text-sm">
              <div className="font-semibold">Tolu Adeniyi</div>
              <div className="text-fg-muted mt-0.5">14 Bourdillon Road, Apt 3B</div>
              <div className="text-fg-muted">Ikoyi, Lagos</div>
              <div className="text-fg-muted font-mono text-xs tabular mt-1">
                +234 803 421 7790
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-3">
              Need help?
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm">
                <MessageCircle className="size-3.5" /> WhatsApp support
              </Button>
              <Button variant="ghost" size="sm">
                <Mail className="size-3.5" /> Email us
              </Button>
            </div>
          </div>

          <Link href="/" className="block">
            <Button variant="secondary" width="full">
              Continue shopping
            </Button>
          </Link>
        </aside>
      </div>
    </div>
  );
}
