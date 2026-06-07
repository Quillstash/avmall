import Link from "next/link";
import {
  Plus,
  ScanLine,
  Download,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Coins,
  Archive,
  Package as PackageIcon,
  Sparkles,
} from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { OrderStatusPill, PaymentStatusPill } from "@/components/ui/status-pill";
import { LineChart, DonutChart } from "@/components/ui/charts";
import { getDashboard, type DashboardData } from "@/lib/data/dashboard";
import {
  getRevenueReport,
  resolveRevenueRange,
  revenueReportArg,
} from "@/lib/data/reports";
import { RevenueRangePicker } from "@/components/admin/revenue-range-picker";
import { formatMoney } from "@/lib/money";
import type { OrderListRow } from "@/lib/data/orders";
import { cn } from "@/lib/utils";

// Hit on every request so the KPIs reflect the live state.
export const dynamic = "force-dynamic";

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const resolved = resolveRevenueRange(searchParams);
  const [data, revenue] = await Promise.all([
    getDashboard(),
    getRevenueReport(revenueReportArg(resolved)),
  ]);
  const revenueLabel = resolved.isCustom
    ? `${fmtDay(revenue.from)} – ${fmtDay(revenue.to)}`
    : `last ${resolved.presetRange} days`;
  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Dashboard" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Dashboard"
            subtitle={
              <>
                {data.todayLabel}
                {data.queue.awaitingConfirm + data.queue.partiallyPaid > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold text-warning">
                      {data.queue.awaitingConfirm + data.queue.partiallyPaid}{" "}
                      orders need attention
                    </span>
                  </>
                )}
              </>
            }
            actions={
              <>
                <Button variant="secondary" size="sm">
                  <Download className="size-3.5" /> Export
                </Button>
                <Link href="/admin/orders/new">
                  <Button variant="secondary" size="sm">
                    <Plus className="size-3.5" /> New order
                  </Button>
                </Link>
                <Link href="/admin/pos">
                  <Button size="sm">
                    <ScanLine className="size-3.5" /> Open register
                  </Button>
                </Link>
              </>
            }
          />

          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
            <KpiCard
              label="Today's revenue"
              value={formatMoney(data.kpi.revenueKobo)}
              delta={formatDeltaPct(data.kpi.revenueDeltaPct)}
              trend={trendOf(data.kpi.revenueDeltaPct)}
              sub="vs yesterday"
            />
            <KpiCard
              label="Today's orders"
              value={String(data.kpi.orderCount)}
              delta={
                data.kpi.orderDelta == null
                  ? null
                  : `${data.kpi.orderDelta >= 0 ? "+" : ""}${data.kpi.orderDelta}`
              }
              trend={
                data.kpi.orderDelta == null
                  ? null
                  : data.kpi.orderDelta > 0
                    ? "up"
                    : data.kpi.orderDelta < 0
                      ? "down"
                      : null
              }
              sub={`${data.kpi.awaitingConfirm} awaiting confirm`}
            />
            <KpiCard
              label="Avg order value"
              value={formatMoney(data.kpi.aovKobo)}
              sub={data.kpi.orderCount === 0 ? "no orders today" : "today's average"}
            />
            <KpiCard
              label="Outstanding"
              value={formatMoney(data.kpi.outstandingKobo)}
              delta={`${data.kpi.partiallyPaidCount} ${
                data.kpi.partiallyPaidCount === 1 ? "order" : "orders"
              }`}
              sub="partially paid"
            />
          </div>

          {/* Chart + donut */}
          <div className="grid lg:grid-cols-[1.7fr_1fr] gap-3.5 mb-5">
            <Card
              title="Revenue"
              actions={
                <RevenueRangePicker
                  basePath="/admin"
                  activeRange={resolved.isCustom ? null : resolved.presetRange}
                  from={resolved.from}
                  to={resolved.to}
                />
              }
            >
              <RevenueChart series={revenue.byDay} label={revenueLabel} />
            </Card>
            <Card title="Orders by status">
              <Donut data={data.ordersByStatus} />
            </Card>
          </div>

          {/* Action queue + recent orders */}
          <div className="grid lg:grid-cols-[1fr_1.7fr] gap-3.5">
            <Card title="Action needed">
              <div className="flex flex-col gap-0.5 -mx-1">
                {data.queue.awaitingConfirm > 0 && (
                  <ActionRow
                    icon={AlertTriangle}
                    tone="warning"
                    title="Awaiting confirmation"
                    sub="Pending review"
                    count={data.queue.awaitingConfirm}
                    href="/admin/orders"
                  />
                )}
                {data.queue.partiallyPaid > 0 && (
                  <ActionRow
                    icon={Coins}
                    tone="warning"
                    title="Partially paid"
                    sub={`${formatMoney(data.queue.partiallyPaidOutstandingKobo)} outstanding`}
                    count={data.queue.partiallyPaid}
                    href="/admin/orders"
                  />
                )}
                {data.queue.returnsPending > 0 && (
                  <ActionRow
                    icon={Archive}
                    tone="danger"
                    title="Returns pending"
                    sub="Approve / process"
                    count={data.queue.returnsPending}
                    href="/admin/returns"
                  />
                )}
                {data.queue.lowStock > 0 && (
                  <ActionRow
                    icon={PackageIcon}
                    tone="warning"
                    title="Low stock items"
                    sub="≤ 5 units on hand"
                    count={data.queue.lowStock}
                    href="/admin/products"
                  />
                )}
                {data.queue.aiHandoffs > 0 && (
                  <ActionRow
                    icon={Sparkles}
                    tone="info"
                    title="AI handoffs"
                    sub="Customer requested human"
                    count={data.queue.aiHandoffs}
                    href="/admin/ai"
                  />
                )}
                {data.queue.awaitingConfirm +
                  data.queue.partiallyPaid +
                  data.queue.returnsPending +
                  data.queue.lowStock +
                  data.queue.aiHandoffs ===
                  0 && (
                  <div className="text-center py-6 text-sm text-fg-muted">
                    Nothing to handle right now. ✨
                  </div>
                )}
              </div>
            </Card>

            <Card
              title="Recent orders"
              actions={
                <Link
                  href="/admin/orders"
                  className="text-xs font-semibold text-brand-primary hover:underline"
                >
                  View all →
                </Link>
              }
              padded={false}
            >
              <RecentOrders rows={data.recentOrders} />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

/** Format a percentage delta for the KPI cards. Returns null for "no signal". */
function formatDeltaPct(p: number | null): string | null {
  if (p == null) return null;
  if (Math.abs(p) < 0.05) return "0%";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

function trendOf(p: number | null): "up" | "down" | null {
  if (p == null || Math.abs(p) < 0.05) return null;
  return p > 0 ? "up" : "down";
}

function KpiCard({
  label,
  value,
  delta,
  trend,
  sub,
}: {
  label: string;
  value: string;
  delta?: string | null;
  trend?: "up" | "down" | null;
  sub: string;
}) {
  const color =
    trend === "up"
      ? "text-brand-accent"
      : trend === "down"
        ? "text-danger"
        : "text-fg-muted";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{label}</div>
      <div className="text-[26px] font-bold tracking-tight mt-2 tabular">{value}</div>
      <div className="flex items-center gap-1.5 mt-1 text-xs">
        {delta && (
          <span className={cn("inline-flex items-center gap-0.5 font-bold", color)}>
            {trend === "up" && <ArrowUp className="size-3" strokeWidth={3} />}
            {trend === "down" && <ArrowDown className="size-3" strokeWidth={3} />}
            {delta}
          </span>
        )}
        <span className="text-fg-muted">{sub}</span>
      </div>
    </div>
  );
}

function Card({
  title,
  actions,
  children,
  padded = true,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3.5 flex items-center justify-between gap-2">
        <div className="text-sm font-bold">{title}</div>
        {actions}
      </div>
      <div className="h-px bg-border" />
      <div className={padded ? "p-4" : ""}>{children}</div>
    </div>
  );
}

function RevenueChart({
  series,
  label,
}: {
  series: { date: string; revenueKobo: number }[];
  label: string;
}) {
  // The series is in kobo; convert to whole-Naira values for the chart so the
  // axis numbers stay readable.
  const data = series.map((s) => s.revenueKobo / 100);
  const total = series.reduce((a, s) => a + s.revenueKobo, 0);

  // Sparse labels so we don't crowd the axis — first day, every 7th, last day.
  const labels = series.map((s, i) =>
    i === 0 || i === series.length - 1 || i % 7 === 0
      ? new Date(s.date).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          timeZone: "Africa/Lagos",
        })
      : "",
  );

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-[28px] font-bold tracking-tight tabular">
          {formatMoney(total)}
        </span>
        <span className="text-xs text-fg-muted">{label}</span>
      </div>
      {data.every((d) => d === 0) ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-fg-muted">
          No orders yet — the chart will fill in as orders come in.
        </div>
      ) : (
        <LineChart data={data} labels={labels} height={200} />
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(var(--warning))",
  confirmed: "hsl(var(--brand-primary))",
  processing: "hsl(262 83% 58%)",
  shipped: "hsl(190 90% 48%)",
  delivered: "hsl(var(--brand-accent))",
  cancelled: "hsl(var(--fg-muted))",
};

function Donut({ data }: { data: DashboardData["ordersByStatus"] }) {
  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div className="h-[180px] flex items-center justify-center text-sm text-fg-muted">
        No orders yet.
      </div>
    );
  }
  const total = data.reduce((a, d) => a + d.count, 0);
  const chartData = data.map((d) => ({
    label: d.status.charAt(0).toUpperCase() + d.status.slice(1),
    value: d.count,
    color: STATUS_COLORS[d.status] ?? "hsl(var(--fg-muted))",
  }));
  return (
    <DonutChart
      data={chartData}
      centerLabel={
        <>
          <div className="text-2xl font-bold tabular">{total}</div>
          <div className="text-[10px] text-fg-muted">orders</div>
        </>
      }
    />
  );
}

function ActionRow({
  icon: Icon,
  tone,
  title,
  sub,
  count,
  href,
}: {
  icon: typeof AlertTriangle;
  tone: "warning" | "danger" | "info";
  title: string;
  sub: string;
  count: number;
  href: string;
}) {
  const toneCls = {
    warning: "bg-warning-bg text-warning",
    danger: "bg-danger-bg text-danger",
    info: "bg-info-bg text-info",
  }[tone];

  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-2 rounded-md hover:bg-surface-2 transition-colors"
    >
      <div className={cn("size-8 rounded-md flex items-center justify-center flex-shrink-0", toneCls)}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-fg-muted">{sub}</div>
      </div>
      <span className="text-sm font-bold tabular min-w-6 text-right">{count}</span>
    </Link>
  );
}

function RecentOrders({ rows }: { rows: OrderListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-fg-muted">
        No orders yet — recent orders will appear here as they come in.
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-surface-2">
        <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
          <th className="text-left px-4 py-2.5">Order</th>
          <th className="text-left px-4 py-2.5">Customer</th>
          <th className="text-right px-4 py-2.5">Total</th>
          <th className="text-left px-4 py-2.5">Status</th>
          <th className="text-left px-4 py-2.5">Created</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.number} className="border-t border-border hover:bg-surface-2">
            <td className="px-4 py-3 font-mono text-xs font-bold tabular">
              <Link href={`/admin/orders/${o.number}`} className="hover:text-brand-primary">
                #{o.number}
              </Link>
            </td>
            <td className="px-4 py-3">
              <div className="font-semibold">{o.customerName}</div>
              <div className="text-[11px] text-fg-muted font-mono tabular">{o.customerPhone}</div>
            </td>
            <td className="px-4 py-3 text-right">
              <Money kobo={o.totalKobo} className="font-bold" />
              <div className="mt-0.5">
                <PaymentStatusPill status={o.payment} bare />
              </div>
            </td>
            <td className="px-4 py-3">
              <OrderStatusPill status={o.status} />
            </td>
            <td className="px-4 py-3 text-xs text-fg-muted">{o.createdAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
