import Link from "next/link";
import { ArrowLeft, Archive } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { getReturnsReport } from "@/lib/data/reports";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { range?: string };
}

export default async function ReturnsReportPage({ searchParams }: PageProps) {
  const range = (() => {
    const n = Number(searchParams.range);
    return [7, 30, 90].includes(n) ? n : 30;
  })();
  const data = await getReturnsReport(range);

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Reports", href: "/admin/reports" },
          { label: "Returns & refunds" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1100px] mx-auto">
          <PageHeader
            title="Returns & refunds"
            subtitle={`Last ${range} days`}
            actions={
              <div className="inline-flex p-0.5 bg-surface-2 rounded-md text-xs font-semibold">
                {[7, 30, 90].map((d) => (
                  <Link
                    key={d}
                    href={`/admin/reports/returns?range=${d}`}
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
            <KpiCard label="Total returns" value={String(data.totalReturns)} sub="in the window" />
            <KpiCard
              label="Refunded"
              value={
                <Money kobo={data.refundedKobo} className="text-2xl font-bold tabular" />
              }
              sub="completed refunds"
            />
            <KpiCard
              label="Pending"
              value={String(data.pending)}
              sub="requested / approved / in transit"
              {...(data.pending > 0 && { tone: "warning" as const })}
            />
            <KpiCard
              label="Outside window"
              value={String(data.outsideWindow)}
              sub="past the 14-day SLA"
              {...(data.outsideWindow > 0 && { tone: "danger" as const })}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-3.5">
            <div className="rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <Archive className="size-4 text-fg-muted" />
                <h2 className="text-sm font-bold">Top return reasons</h2>
              </div>
              {data.byReason.length === 0 ? (
                <p className="text-sm text-fg-muted">No returns yet.</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {data.byReason.map((r) => (
                    <li key={r.reason} className="flex items-center justify-between">
                      <span className="capitalize">{r.reason}</span>
                      <span className="font-bold tabular">{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-sm font-bold mb-3">By status</h2>
              {data.byStatus.length === 0 ? (
                <p className="text-sm text-fg-muted">No returns yet.</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {data.byStatus.map((r) => (
                    <li key={r.status} className="flex items-center justify-between">
                      <Badge>{r.status.replace(/_/g, " ")}</Badge>
                      <span className="font-bold tabular">{r.count}</span>
                    </li>
                  ))}
                </ul>
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

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  tone?: "warning" | "danger";
}) {
  const valColor =
    tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-fg";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div className={`text-2xl font-bold tabular mt-1.5 ${valColor}`}>{value}</div>
      <div className="text-[11px] text-fg-muted mt-0.5">{sub}</div>
    </div>
  );
}
