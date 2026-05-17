import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Money } from "@/components/ui/money";
import { LineChart } from "@/components/ui/charts";
import { getRevenueReport } from "@/lib/data/reports";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { range?: string };
}

export default async function RevenueReportPage({ searchParams }: PageProps) {
  const range = (() => {
    const n = Number(searchParams.range);
    return [7, 30, 90].includes(n) ? n : 30;
  })();
  const data = await getRevenueReport(range);

  const series = data.byDay.map((d) => d.revenueKobo / 100);
  const labels = data.byDay.map((d, i) =>
    i === 0 || i === data.byDay.length - 1 || i % 7 === 0
      ? new Date(d.date).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          timeZone: "Africa/Lagos",
        })
      : "",
  );

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Reports", href: "/admin/reports" },
          { label: "Revenue & sales" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1200px] mx-auto">
          <PageHeader
            title="Revenue & sales"
            subtitle={`Last ${range} days`}
            actions={
              <div className="inline-flex p-0.5 bg-surface-2 rounded-md text-xs font-semibold">
                {[7, 30, 90].map((d) => (
                  <Link
                    key={d}
                    href={`/admin/reports/revenue?range=${d}`}
                    className={
                      d === range
                        ? "px-2.5 py-1 rounded-sm bg-surface shadow-sm text-fg"
                        : "px-2.5 py-1 rounded-sm text-fg-muted"
                    }
                  >
                    {d}d
                  </Link>
                ))}
              </div>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
            <KpiCard label="Revenue" value={formatMoney(data.totalRevenueKobo)} sub={`${range} days`} />
            <KpiCard label="Orders" value={String(data.totalOrders)} sub="non-cancelled" />
            <KpiCard label="AOV" value={formatMoney(data.aovKobo)} sub="per order" />
          </div>

          <div className="rounded-lg border border-border bg-surface p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="size-4 text-brand-accent" />
              <h2 className="text-sm font-bold">Daily revenue</h2>
            </div>
            {series.every((v) => v === 0) ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-fg-muted">
                No orders in the window yet.
              </div>
            ) : (
              <LineChart data={series} labels={labels} height={220} />
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-3.5">
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-sm font-bold mb-3">By payment method</h2>
              {data.byPaymentMethod.length === 0 ? (
                <p className="text-sm text-fg-muted">No completed payments yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <tr>
                      <th className="text-left py-1.5">Method</th>
                      <th className="text-right py-1.5">Count</th>
                      <th className="text-right py-1.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byPaymentMethod.map((r) => (
                      <tr key={r.method} className="border-t border-border">
                        <td className="py-2 capitalize">{r.method.replace(/_/g, " ")}</td>
                        <td className="py-2 text-right tabular">{r.count}</td>
                        <td className="py-2 text-right">
                          <Money kobo={r.amountKobo} className="font-bold" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-sm font-bold mb-3">By channel</h2>
              {data.byChannel.length === 0 ? (
                <p className="text-sm text-fg-muted">No orders yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <tr>
                      <th className="text-left py-1.5">Channel</th>
                      <th className="text-right py-1.5">Orders</th>
                      <th className="text-right py-1.5">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byChannel.map((r) => (
                      <tr key={r.source} className="border-t border-border">
                        <td className="py-2 capitalize">{r.source}</td>
                        <td className="py-2 text-right tabular">{r.orderCount}</td>
                        <td className="py-2 text-right">
                          <Money kobo={r.revenueKobo} className="font-bold" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-fg mt-6"
          >
            <ArrowLeft className="size-3.5" /> Back to all reports
          </Link>
        </div>
      </div>
    </>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div className="text-2xl font-bold tabular mt-1.5">{value}</div>
      <div className="text-[11px] text-fg-muted mt-0.5">{sub}</div>
    </div>
  );
}
