import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Money } from "@/components/ui/money";
import { OrderStatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { getCustomerSession } from "@/lib/customer-session";
import { listCustomerOrders } from "@/lib/data/orders";

export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const session = await getCustomerSession();
  // Guests have no (UUID) customer id — redirect to login instead of querying
  // with an empty id, which throws on the uuid column and 500s the page.
  if (!session) redirect("/login?next=/account/orders");
  const orders = await listCustomerOrders(session.customerId);

  return (
    <div>
      <div className="flex items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight">
            Orders
          </h1>
          <p className="text-sm text-fg-muted mt-1">{orders.length} orders to date</p>
        </div>
        <Select className="h-10 w-40 text-sm">
          <option>All time</option>
          <option>Last 30 days</option>
          <option>Last 6 months</option>
          <option>This year</option>
        </Select>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-fg-muted mb-4">You haven&apos;t placed any orders yet.</p>
          <Link href="/">
            <Button>Start shopping</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <div
              key={o.number}
              className="p-5 rounded-lg border border-border bg-surface hover:border-border-strong transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm tabular">#{o.number}</span>
                    <OrderStatusPill status={o.status} />
                  </div>
                  <div className="text-xs text-fg-muted mt-1">
                    {o.date} · {o.items} items
                  </div>
                </div>
                <Money kobo={o.totalKobo} className="text-base font-bold" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/orders/${o.number}`}>
                  <Button variant="secondary" size="sm">
                    Track order <ChevronRight className="size-3.5" />
                  </Button>
                </Link>
                <Button variant="ghost" size="sm">
                  Buy again
                </Button>
                {o.status === "delivered" && (
                  <Link href={`/account/orders/${o.number}/return`}>
                    <Button variant="ghost" size="sm">
                      Request return
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
