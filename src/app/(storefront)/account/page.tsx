import Link from "next/link";
import { Package, MapPin, User, ChevronRight } from "lucide-react";
import { Money } from "@/components/ui/money";
import { OrderStatusPill } from "@/components/ui/status-pill";

const RECENT_ORDERS = [
  { number: "AVM-2841", date: "Tue 14 Jan", totalKobo: 6294000, status: "confirmed" as const, items: 3 },
  { number: "AVM-2811", date: "8 Jan", totalKobo: 18900000, status: "delivered" as const, items: 6 },
  { number: "AVM-2790", date: "2 Jan", totalKobo: 8400000, status: "delivered" as const, items: 2 },
];

export default function AccountPage() {
  return (
    <div>
      <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight mb-2">
        Welcome back, Tolu.
      </h1>
      <p className="text-sm text-fg-muted mb-8">
        14 orders to date · ₦1.84M lifetime · VIP customer
      </p>

      {/* Quick stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {[
          { l: "Total orders", v: "14" },
          { l: "Lifetime spend", v: "₦1.84M" },
          { l: "Store credit", v: "₦12,500" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-border bg-surface p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-fg-muted">{s.l}</div>
            <div className="font-display text-2xl font-semibold tracking-tight mt-1 tabular">
              {s.v}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-8">
        {/* Recent orders */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base">Recent orders</h2>
            <Link href="/account/orders" className="text-sm font-semibold text-brand-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {RECENT_ORDERS.map((o) => (
              <Link
                key={o.number}
                href={`/orders/${o.number}`}
                className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border bg-surface hover:border-border-strong transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-sm tabular">#{o.number}</span>
                    <OrderStatusPill status={o.status} />
                  </div>
                  <div className="text-xs text-fg-muted">
                    {o.date} · {o.items} items
                  </div>
                </div>
                <div className="text-right">
                  <Money kobo={o.totalKobo} className="font-bold text-sm" />
                </div>
                <ChevronRight className="size-4 text-fg-muted" />
              </Link>
            ))}
          </div>
        </div>

        {/* Sidebar shortcuts (mobile) */}
        <div className="lg:hidden flex flex-col gap-2">
          {[
            { href: "/account/orders", label: "Orders", icon: Package },
            { href: "/account/addresses", label: "Addresses", icon: MapPin },
            { href: "/account/profile", label: "Profile", icon: User },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 p-4 rounded-lg border border-border bg-surface"
            >
              <div className="size-10 rounded-md bg-info-bg text-brand-primary flex items-center justify-center">
                <Icon className="size-5" />
              </div>
              <span className="font-semibold text-sm flex-1">{label}</span>
              <ChevronRight className="size-4 text-fg-muted" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
