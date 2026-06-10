import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  MessageCircle,
  Mail,
  ShieldAlert,
  MoreHorizontal,
  CreditCard,
} from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { OrderStatusPill, PaymentStatusPill } from "@/components/ui/status-pill";
import { getCustomer } from "@/lib/data/customers";
import { listAdminOrders } from "@/lib/data/orders";
import { formatMoney } from "@/lib/money";

interface PageProps {
  params: { id: string };
}

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const customer = await getCustomer(params.id);
  if (!customer) notFound();

  const allOrders = await listAdminOrders();
  const orders = allOrders
    .filter(
      (o) => o.customerName === customer.name || o.customerPhone === customer.phone,
    )
    .slice(0, 6);

  const initials = customer.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const lifetimeLabel = formatMoney(customer.lifetimeKobo);
  const avgOrder = customer.ordersCount > 0
    ? formatMoney(Math.floor(customer.lifetimeKobo / customer.ordersCount))
    : "—";
  const lastOrderLabel = customer.lastOrderAt
    ? humanizeDate(customer.lastOrderAt)
    : "Never";

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Customers", href: "/admin/customers" },
          { label: customer.name },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto pb-20">
          {customer.blacklisted && (
            <BlacklistBanner reason={customer.blacklistReason} />
          )}

          <PageHeader
            title={customer.name}
            subtitle={
              <span className="inline-flex items-center gap-2">
                <span className="font-mono tabular">{customer.phone}</span>
                {customer.email && <span>· {customer.email}</span>}
              </span>
            }
            actions={
              <>
                <Button variant="ghost" size="sm">
                  <Phone className="size-3.5" /> Call
                </Button>
                <Button variant="ghost" size="sm">
                  <MessageCircle className="size-3.5" /> WhatsApp
                </Button>
                <Button variant="ghost" size="sm">
                  <Mail className="size-3.5" /> Email
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="size-4" />
                </Button>
              </>
            }
          />

          <div className="grid lg:grid-cols-[280px_1fr] gap-4">
            {/* Sidebar */}
            <div className="flex flex-col gap-4">
              <Card>
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-14 rounded-full bg-gradient-to-br from-brand-primary to-[hsl(262_60%_48%)] text-white flex items-center justify-center font-bold text-lg">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{customer.name}</div>
                    <div className="text-[11px] text-fg-muted">
                      Customer since Oct 2024
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {customer.segments.map((s) => (
                    <Badge key={s} tone={s === "VIP" ? "brand" : "neutral"}>
                      {s}
                    </Badge>
                  ))}
                  {customer.blacklisted && <Badge tone="danger">Blacklisted</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
                  <Stat label="Orders" value={String(customer.ordersCount)} />
                  <Stat label="Lifetime" value={lifetimeLabel} />
                  <Stat label="Avg order" value={avgOrder} />
                  <Stat label="Last order" value={lastOrderLabel} />
                </div>

                {customer.installmentOutstandingKobo > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between gap-2 rounded-md bg-info-bg/50 border border-brand-primary/20 px-3 py-2.5">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary">
                        <CreditCard className="size-3.5" /> Owed on installments
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold tabular">
                          {formatMoney(customer.installmentOutstandingKobo)}
                        </div>
                        <div className="text-[10px] text-fg-muted">
                          {customer.activeInstallmentPlans} active plan
                          {customer.activeInstallmentPlans === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <Card title="Contact">
                <div className="text-sm space-y-1.5">
                  <div className="flex items-center gap-2 text-fg-muted">
                    <Phone className="size-3.5" />
                    <span className="font-mono tabular">{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-fg-muted">
                      <Mail className="size-3.5" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                </div>
              </Card>

            </div>

            {/* Main */}
            <div className="flex flex-col gap-4 min-w-0">
              <Card
                title="Orders"
                action={
                  <span className="text-[11px] text-fg-muted">{customer.ordersCount} total</span>
                }
                padded={false}
              >
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="bg-surface-2">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                      <th className="text-left px-3.5 py-2.5">Order</th>
                      <th className="text-right px-3.5 py-2.5">Items</th>
                      <th className="text-right px-3.5 py-2.5">Total</th>
                      <th className="text-left px-3.5 py-2.5">Status</th>
                      <th className="text-left px-3.5 py-2.5">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.number} className="border-t border-border hover:bg-surface-2">
                        <td className="px-3.5 py-3 font-mono text-xs font-bold tabular">
                          <Link
                            href={`/admin/orders/${o.number}`}
                            className="hover:text-brand-primary"
                          >
                            #{o.number}
                          </Link>
                        </td>
                        <td className="px-3.5 py-3 text-right tabular">{o.items}</td>
                        <td className="px-3.5 py-3 text-right">
                          <Money kobo={o.totalKobo} className="font-bold" />
                          <div className="mt-0.5">
                            <PaymentStatusPill status={o.payment} bare />
                          </div>
                        </td>
                        <td className="px-3.5 py-3">
                          <OrderStatusPill status={o.status} />
                        </td>
                        <td className="px-3.5 py-3 text-xs text-fg-muted">{o.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({
  title,
  action,
  children,
  padded = true,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      {title && (
        <>
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <div className="text-sm font-bold">{title}</div>
            {action}
          </div>
          <div className="h-px bg-border" />
        </>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </div>
  );
}

function humanizeDate(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">{label}</div>
      <div className="text-sm font-bold tabular mt-0.5">{value}</div>
    </div>
  );
}

function BlacklistBanner({ reason }: { reason: string | null }) {
  return (
    <div className="mb-4 p-4 rounded-lg bg-danger-bg border border-danger/30 flex items-start gap-3">
      <ShieldAlert className="size-5 text-danger flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-bold text-sm text-danger mb-1">Blacklisted customer</div>
        <p className="text-xs text-fg-muted leading-relaxed">
          This customer has been blocked. New orders are locked from further action.
          {reason && (
            <>
              {" "}Reason: <span className="italic">{reason}</span>
            </>
          )}
        </p>
        <div className="flex gap-2 mt-2.5">
          <Button variant="ghost" size="sm">
            Unblock (Manager+)
          </Button>
        </div>
      </div>
    </div>
  );
}
