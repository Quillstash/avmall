"use client";

import * as React from "react";
import Link from "next/link";
import { History, User, MessageCircle, PackageX } from "lucide-react";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/money";
import type { ProductSalesHistory } from "@/lib/data/product-history";

const dayFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric", month: "short", year: "numeric",
  hour: "numeric", minute: "2-digit",
  timeZone: "Africa/Lagos",
});
const shortDay = new Intl.DateTimeFormat("en-NG", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos",
});

export function ProductSalesHistory({ history }: { history: ProductSalesHistory }) {
  const h = history;
  const hasSales = h.rowsTotal > 0;

  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <History className="size-4 text-brand-primary" />
        <div className="text-sm font-bold">Sales history</div>
        {hasSales && (
          <span className="text-xs text-fg-muted">
            · {h.unitsSold} unit{h.unitsSold === 1 ? "" : "s"} across {h.ordersCount} order
            {h.ordersCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {!hasSales ? (
        <div className="p-10 text-center text-sm text-fg-muted">
          <PackageX className="size-6 mx-auto mb-2" />
          This product hasn&apos;t sold yet. Sales will appear here as they happen.
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-4">
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Units sold" value={String(h.unitsSold)} />
            <Stat label="Revenue" value={formatMoney(h.revenueKobo)} />
            <Stat
              label="First → last sold"
              value={
                h.firstSoldAt && h.lastSoldAt
                  ? `${shortDay.format(new Date(h.firstSoldAt))} – ${shortDay.format(new Date(h.lastSoldAt))}`
                  : "—"
              }
              small
            />
            <Stat
              label="Returned"
              value={String(h.returnedUnits)}
              {...(h.returnedUnits > 0 ? { tone: "warn" as const } : {})}
            />
          </div>

          {/* Breakdowns */}
          <div className="grid md:grid-cols-2 gap-3">
            <Breakdown title="By channel">
              {h.byChannel.map((c) => (
                <BreakdownRow key={c.channel} label={c.label} units={c.units} kobo={c.revenueKobo} />
              ))}
            </Breakdown>
            <Breakdown title="Sold by">
              {h.byStaff.map((s) => (
                <BreakdownRow key={s.name} label={s.name} units={s.units} kobo={s.revenueKobo} icon />
              ))}
            </Breakdown>
          </div>

          {/* Ledger */}
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-fg-muted border-b border-border">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Order</th>
                  <th className="py-2 pr-3 font-semibold text-right">Qty</th>
                  <th className="py-2 pr-3 font-semibold text-right">Unit</th>
                  <th className="py-2 pr-3 font-semibold text-right">Total</th>
                  <th className="py-2 pr-3 font-semibold">Channel</th>
                  <th className="py-2 pr-3 font-semibold">Sold by</th>
                  <th className="py-2 pr-3 font-semibold">Customer</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {h.rows.map((r, i) => (
                  <tr key={`${r.orderNumber}-${i}`} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-fg-muted">
                      {dayFmt.format(new Date(r.date))}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <Link
                        href={`/admin/orders/${r.orderNumber}`}
                        className="font-mono text-xs font-semibold text-brand-primary hover:underline"
                      >
                        {r.orderNumber}
                      </Link>
                      {r.variant && (
                        <span className="block text-[11px] text-fg-subtle">{r.variant}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular font-semibold">{r.quantity}</td>
                    <td className="py-2.5 pr-3 text-right tabular text-fg-muted">
                      <Money kobo={r.unitKobo} />
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular font-semibold">
                      <Money kobo={r.lineTotalKobo} />
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs">
                        {r.channel === "whatsapp" && <MessageCircle className="size-3" />}
                        {r.channelLabel}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-fg-muted">
                      {r.staffName ?? <span className="italic text-fg-subtle">Online</span>}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-fg-muted">
                      {r.customerName ?? "—"}
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${statusTone(r.orderStatus)}`}
                      >
                        {r.orderStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {h.rowsTotal > h.rows.length && (
            <p className="text-xs text-fg-muted text-center">
              Showing the {h.rows.length} most recent of {h.rowsTotal} sale lines.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

ProductSalesHistory.displayName = "ProductSalesHistory";

function Stat({ label, value, small, tone }: { label: string; value: string; small?: boolean; tone?: "warn" }) {
  return (
    <div className="rounded-md bg-surface-2 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-fg-muted">{label}</div>
      <div className={`font-bold tabular mt-0.5 ${small ? "text-xs" : "text-lg"} ${tone === "warn" ? "text-warning" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Breakdown({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-2">{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function BreakdownRow({ label, units, kobo, icon }: { label: string; units: number; kobo: number; icon?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
        {icon && <User className="size-3 text-fg-muted flex-shrink-0" />}
        <span className="truncate">{label}</span>
      </span>
      <span className="text-fg-muted tabular flex-shrink-0">
        {units}u · <span className="font-semibold text-fg">{formatMoney(kobo)}</span>
      </span>
    </div>
  );
}

function statusTone(status: string): string {
  switch (status) {
    case "delivered":
      return "bg-success-bg text-brand-accent";
    case "shipped":
    case "processing":
    case "confirmed":
      return "bg-info-bg text-brand-primary";
    case "cancelled":
      return "bg-danger-bg text-danger";
    default:
      return "bg-surface-2 text-fg-muted";
  }
}
