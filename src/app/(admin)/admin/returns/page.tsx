import Link from "next/link";
import { Download, Search, ChevronDown, MoreHorizontal, AlertTriangle, Clock } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { RETURNS, type ReturnStatus } from "@/lib/admin-mock-data";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  in_transit: "In transit",
  received: "Received",
  refunded: "Refunded",
  rejected: "Rejected",
};

const STATUS_CLASSES: Record<ReturnStatus, string> = {
  requested: "bg-warning-bg text-warning",
  approved: "bg-info-bg text-info",
  in_transit: "bg-status-shipped/15 text-status-shipped",
  received: "bg-status-processing/15 text-status-processing",
  refunded: "bg-success-bg text-success",
  rejected: "bg-surface-2 text-fg-muted",
};

export default function AdminReturnsListPage() {
  const sla = RETURNS.filter((r) => r.slaBreached).length;
  const pending = RETURNS.filter((r) => r.status === "requested" || r.status === "approved").length;

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Returns" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Returns"
            subtitle={`${RETURNS.length} returns · ${pending} pending · ${sla} over SLA`}
            actions={
              <Button variant="secondary" size="sm">
                <Download className="size-3.5" /> Export
              </Button>
            }
          />

          {/* Saved views */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {[
              { l: "All", n: RETURNS.length, active: true },
              { l: "Pending", n: pending },
              { l: "Over SLA", n: sla },
              { l: "Outside window", n: RETURNS.filter((r) => r.outsideWindow).length },
              { l: "Refunded", n: RETURNS.filter((r) => r.status === "refunded").length },
            ].map((v) => (
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
              <span>Return ID, order, customer…</span>
            </div>
            {["Status: Any", "Reason: Any", "Date: Last 30 days"].map((f) => (
              <button
                key={f}
                className="inline-flex items-center gap-1 px-3 h-9 bg-surface border border-border-strong rounded-md text-xs font-semibold hover:bg-surface-2"
              >
                {f} <ChevronDown className="size-3" />
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <th className="text-left px-3.5 py-2.5">Return</th>
                    <th className="text-left px-3.5 py-2.5">Order</th>
                    <th className="text-left px-3.5 py-2.5">Customer</th>
                    <th className="text-left px-3.5 py-2.5">Reason</th>
                    <th className="text-right px-3.5 py-2.5">Refund</th>
                    <th className="text-left px-3.5 py-2.5">Status</th>
                    <th className="text-left px-3.5 py-2.5">Created</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {RETURNS.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-surface-2">
                      <td className="px-3.5 py-3 font-mono text-xs font-bold tabular">
                        <Link
                          href={`/admin/returns/${r.id}`}
                          className="hover:text-brand-primary"
                        >
                          {r.id}
                        </Link>
                      </td>
                      <td className="px-3.5 py-3 font-mono text-xs tabular">
                        <Link
                          href={`/admin/orders/${r.orderNumber}`}
                          className="hover:text-brand-primary"
                        >
                          #{r.orderNumber}
                        </Link>
                      </td>
                      <td className="px-3.5 py-3 font-semibold">{r.customerName}</td>
                      <td className="px-3.5 py-3 text-fg-muted">{r.reason}</td>
                      <td className="px-3.5 py-3 text-right">
                        <Money kobo={r.refundKobo} className="font-bold" />
                      </td>
                      <td className="px-3.5 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                            STATUS_CLASSES[r.status],
                          )}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          {STATUS_LABELS[r.status]}
                        </span>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {r.slaBreached && (
                            <Badge tone="danger" className="inline-flex items-center gap-1">
                              <Clock className="size-2.5" /> SLA
                            </Badge>
                          )}
                          {r.outsideWindow && (
                            <Badge tone="warning" className="inline-flex items-center gap-1">
                              <AlertTriangle className="size-2.5" /> outside window
                            </Badge>
                          )}
                          {r.fullyReturned && <Badge tone="neutral">fully returned</Badge>}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-xs text-fg-muted">{r.createdAt}</td>
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
          </div>
        </div>
      </div>
    </>
  );
}
