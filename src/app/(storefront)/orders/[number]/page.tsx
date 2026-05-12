import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, MapPin, Truck, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderStatusPill } from "@/components/ui/status-pill";
import { Money } from "@/components/ui/money";
import { Timeline, type TimelineEvent } from "@/components/ui/timeline";
import { getCustomerOrder } from "@/lib/data/orders";
import { getCustomerSession } from "@/lib/customer-session";
import { formatNigerianPhone } from "@/lib/phone";

interface PageProps {
  params: { number: string };
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const session = await getCustomerSession();
  // Customers can only see their own orders. When DB is missing the helper
  // returns the same mock order regardless, which is fine for design mode.
  const order = await getCustomerOrder(params.number, session?.customerId ?? null);
  if (!order) notFound();

  const placedAt = order.createdAt.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });

  const steps: TimelineEvent[] = [
    {
      title: "Order placed",
      subtitle: placedAt,
      done: true,
      current: order.status === "pending",
    },
    {
      title: "Confirmed",
      subtitle: order.status === "pending" ? "pending" : "",
      done: order.status !== "pending",
      current: order.status === "confirmed" || order.status === "processing",
    },
    {
      title: "Shipped",
      done: order.status === "shipped" || order.status === "delivered",
      current: order.status === "shipped",
    },
    {
      title: "Delivered",
      done: order.status === "delivered",
      current: order.status === "delivered",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 py-10 lg:py-16">
      <div className="text-center mb-10">
        <div className="size-16 mx-auto mb-5 rounded-full bg-brand-accent flex items-center justify-center text-white">
          <Check className="size-8" strokeWidth={3} />
        </div>
        <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight mb-2">
          Thanks, {order.shipping.name.split(" ")[0]} — your order is confirmed.
        </h1>
        <p className="text-sm text-fg-muted">
          A receipt has been sent to your phone. We&apos;ll text you again when it ships.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 lg:gap-8">
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-border bg-surface p-5 lg:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-fg-muted">
                Order number
              </div>
              <div className="font-mono font-bold text-lg tabular mt-0.5">#{order.number}</div>
            </div>
            <OrderStatusPill status={order.status} />
          </div>

          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="px-5 lg:px-6 py-4 border-b border-border">
              <div className="text-sm font-bold">Items</div>
            </div>
            <div className="divide-y divide-border">
              {order.lines.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-5 lg:px-6 py-4">
                  <div className="size-14 flex-shrink-0 rounded-md bg-surface-2" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold leading-snug">{l.name}</div>
                    <div className="text-xs text-fg-muted">
                      {l.variant ?? "—"} · qty {l.quantity}
                    </div>
                  </div>
                  <Money
                    kobo={l.unitKobo * l.quantity - l.bulkDiscountKobo}
                    className="font-semibold"
                  />
                </div>
              ))}
            </div>
            <div className="px-5 lg:px-6 py-4 border-t border-border bg-surface-2 flex justify-between text-base font-bold">
              <span>Total</span>
              <Money kobo={order.totals.totalKobo} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 lg:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="size-4" />
              <div className="font-bold text-sm">
                Estimated delivery:{" "}
                {order.shipping.state === "Lagos" ? "tomorrow by 6pm" : "2–5 business days"}
              </div>
            </div>
            <Timeline events={steps} />
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">
              <MapPin className="size-3.5" /> Shipping to
            </div>
            <div className="text-sm">
              <div className="font-semibold">{order.shipping.name}</div>
              <div className="text-fg-muted mt-0.5">{order.shipping.line1}</div>
              {order.shipping.line2 && (
                <div className="text-fg-muted">{order.shipping.line2}</div>
              )}
              <div className="text-fg-muted">
                {order.shipping.city}, {order.shipping.state}
              </div>
              <div className="text-fg-muted font-mono text-xs tabular mt-1">
                {formatNigerianPhone(order.shipping.phone)}
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
