import Link from "next/link";
import {
  Plus,
  Download,
  Search,
  ChevronDown,
  MoreHorizontal,
  MessageCircle,
} from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { OrderStatusPill, PaymentStatusPill } from "@/components/ui/status-pill";
import { ORDERS_LIST, type OrderSource } from "@/lib/admin-mock-data";
import { cn } from "@/lib/utils";

const SAVED_VIEWS = [
  { l: "Today's orders", n: 47, active: true },
  { l: "Awaiting confirm", n: 5 },
  { l: "Partially paid", n: 14 },
  { l: "Outstanding balance", n: 22 },
  { l: "Returns pending", n: 3 },
  { l: "WhatsApp source", n: 38 },
  { l: "Blacklisted", n: 2 },
] as const;

const FILTERS = [
  "Status: Any",
  "Payment: Any",
  "Source: Any",
  "Date: Last 7 days",
  "Staff: Any",
] as const;

export default function AdminOrdersListPage() {
  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Orders" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Orders"
            subtitle="284 orders this week · ₦24.8M"
            actions={
              <>
                <Button variant="secondary" size="sm">
                  <Download className="size-3.5" /> Export
                </Button>
                <Button size="sm">
                  <Plus className="size-3.5" /> New order
                </Button>
              </>
            }
          />

          {/* Saved views */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {SAVED_VIEWS.map((v) => (
              <button
                key={v.l}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
                  "active" in v && v.active
                    ? "bg-info-bg border-brand-primary/30 text-brand-primary"
                    : "bg-surface border-border text-fg hover:border-border-strong",
                )}
              >
                {v.l}
                <span className="opacity-60 tabular">{v.n}</span>
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="rounded-lg border border-border bg-surface p-3 mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 h-9 bg-surface-2 rounded-md text-sm text-fg-muted flex-1 min-w-[200px]">
              <Search className="size-4" />
              <span>Order #, customer, phone…</span>
            </div>
            {FILTERS.map((f) => (
              <button
                key={f}
                className="inline-flex items-center gap-1 px-3 h-9 bg-surface border border-border-strong rounded-md text-xs font-semibold hover:bg-surface-2"
              >
                {f} <ChevronDown className="size-3" />
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <th className="px-3.5 py-2.5 w-8">
                      <input type="checkbox" className="accent-brand-primary" />
                    </th>
                    <th className="text-left px-3.5 py-2.5">Order</th>
                    <th className="text-left px-3.5 py-2.5">Customer</th>
                    <th className="text-right px-3.5 py-2.5">Items</th>
                    <th className="text-right px-3.5 py-2.5">Total</th>
                    <th className="text-left px-3.5 py-2.5">Status</th>
                    <th className="text-left px-3.5 py-2.5">Source</th>
                    <th className="text-left px-3.5 py-2.5">Created</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {ORDERS_LIST.map((o) => (
                    <tr key={o.number} className="border-t border-border hover:bg-surface-2">
                      <td className="px-3.5 py-3">
                        <input type="checkbox" className="accent-brand-primary" />
                      </td>
                      <td className="px-3.5 py-3 font-mono text-xs font-bold tabular">
                        <Link
                          href={`/admin/orders/${o.number}`}
                          className="hover:text-brand-primary"
                        >
                          #{o.number}
                        </Link>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="font-semibold">{o.customerName}</div>
                        <div className="text-[11px] text-fg-muted font-mono tabular">
                          {o.customerPhone}
                        </div>
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
                      <td className="px-3.5 py-3">
                        <SourceChip source={o.source} />
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="text-xs text-fg-muted">{o.createdAt}</div>
                        <div className="text-[10px] text-fg-subtle">by {o.createdBy}</div>
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <button
                          className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-2 text-xs text-fg-muted">
              <span>Showing 1–10 of 284 orders</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" disabled>
                  Previous
                </Button>
                <Button size="sm" variant="ghost">
                  Next →
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SourceChip({ source }: { source: OrderSource }) {
  const labels: Record<OrderSource, string> = {
    web: "Web",
    whatsapp: "WhatsApp",
    phone: "Phone",
    walkin: "Walk-in",
    ai: "Ada (AI)",
  };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2 text-xs font-medium">
      {source === "whatsapp" && <MessageCircle className="size-3" />}
      {labels[source]}
    </span>
  );
}
