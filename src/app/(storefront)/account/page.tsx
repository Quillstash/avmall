import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, MapPin, User, ChevronRight, ShoppingBag } from "lucide-react";
import { Money } from "@/components/ui/money";
import { OrderStatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { getCustomerSession } from "@/lib/customer-session";
import { db, hasDatabase } from "@/lib/db";
import { listCustomerOrders } from "@/lib/data/orders";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) {
    // The layout-level redirect should catch this; belt + braces.
    redirect("/login?next=/account");
  }

  // Pull customer name, lifetime stats, and recent orders in parallel. We
  // compute lifetime spend from completed payments only — unpaid orders
  // aren't "spent" yet, see CLAUDE.md §9.
  let name = "there";
  let totalOrders = 0;
  let lifetimeSpendKobo = 0;
  let recentOrders: Awaited<ReturnType<typeof listCustomerOrders>> = [];

  if (hasDatabase) {
    const [customer, allOrders] = await Promise.all([
      db.customer.findUnique({
        where: { id: session.customerId },
        select: { name: true },
      }),
      listCustomerOrders(session.customerId),
    ]);

    if (customer) name = customer.name.split(/\s+/)[0] ?? customer.name;
    totalOrders = allOrders.length;
    recentOrders = allOrders.slice(0, 3);

    if (allOrders.length > 0) {
      const paidSums = await db.order.findMany({
        where: { customerId: session.customerId },
        select: { paidKobo: true },
      });
      lifetimeSpendKobo = paidSums.reduce(
        (sum, o) => sum + Number(o.paidKobo),
        0,
      );
    }
  } else {
    recentOrders = await listCustomerOrders(session.customerId);
    totalOrders = recentOrders.length;
    lifetimeSpendKobo = recentOrders.reduce((s, o) => s + o.totalKobo, 0);
  }

  const firstName = name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <div>
      <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight mb-2">
        Welcome back, {firstName}.
      </h1>
      <p className="text-sm text-fg-muted mb-8">
        {totalOrders === 0
          ? "You haven't placed any orders yet."
          : `${totalOrders} order${totalOrders === 1 ? "" : "s"} placed · ${formatMoney(lifetimeSpendKobo)} lifetime spend`}
      </p>

      {/* Quick stats. */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <StatCard label="Total orders" value={totalOrders.toString()} />
        <StatCard
          label="Lifetime spend"
          value={formatMoney(lifetimeSpendKobo)}
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base">Recent orders</h2>
            {totalOrders > 0 && (
              <Link
                href="/account/orders"
                className="text-sm font-semibold text-brand-primary hover:underline"
              >
                View all →
              </Link>
            )}
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="size-8" />}
              title="No orders yet"
              description="Once you place an order, you'll be able to track it here."
              action={
                <Link href="/">
                  <Button size="sm">Start shopping</Button>
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {recentOrders.map((o) => (
                <Link
                  key={o.number}
                  href={`/orders/${o.number}`}
                  className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border bg-surface hover:border-border-strong transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-sm tabular">
                        #{o.number}
                      </span>
                      <OrderStatusPill status={o.status} />
                    </div>
                    <div className="text-xs text-fg-muted">
                      {o.date} · {o.items} {o.items === 1 ? "item" : "items"}
                    </div>
                  </div>
                  <div className="text-right">
                    <Money kobo={o.totalKobo} className="font-bold text-sm" />
                  </div>
                  <ChevronRight className="size-4 text-fg-muted" />
                </Link>
              ))}
            </div>
          )}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div className="font-display text-2xl font-semibold tracking-tight mt-1 tabular">
        {value}
      </div>
    </div>
  );
}
