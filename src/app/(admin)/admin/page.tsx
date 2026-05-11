import Link from "next/link";
import {
  Plus,
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
import { ORDERS_LIST } from "@/lib/admin-mock-data";
import { cn } from "@/lib/utils";

export default function AdminDashboardPage() {
  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Dashboard" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Good afternoon, Funmi."
            subtitle={
              <>
                Tuesday, 14 January 2026 ·{" "}
                <span className="font-semibold text-warning">12 orders need attention</span>
              </>
            }
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

          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
            <KpiCard label="Today's revenue" value="₦2,418,500" delta="+12.4%" trend="up" sub="vs yesterday" />
            <KpiCard label="Today's orders" value="47" delta="+8" trend="up" sub="5 awaiting confirm" />
            <KpiCard label="Avg order value" value="₦51,460" delta="−2.1%" trend="down" sub="vs last 7d avg" />
            <KpiCard label="Outstanding" value="₦612,400" delta="14 orders" sub="partially paid" />
          </div>

          {/* Chart + donut */}
          <div className="grid lg:grid-cols-[1.7fr_1fr] gap-3.5 mb-5">
            <Card title="Revenue · last 30 days" actions={<TimeToggle />}>
              <RevenueChart />
            </Card>
            <Card title="Orders by status">
              <Donut />
            </Card>
          </div>

          {/* Action queue + recent orders */}
          <div className="grid lg:grid-cols-[1fr_1.7fr] gap-3.5">
            <Card title="Action needed">
              <div className="flex flex-col gap-0.5 -mx-1">
                <ActionRow
                  icon={AlertTriangle}
                  tone="warning"
                  title="Awaiting confirmation"
                  sub="Oldest 3h ago"
                  count={5}
                  href="/admin/orders"
                />
                <ActionRow
                  icon={Coins}
                  tone="warning"
                  title="Partially paid"
                  sub="₦612k outstanding"
                  count={14}
                  href="/admin/orders"
                />
                <ActionRow
                  icon={Archive}
                  tone="danger"
                  title="Returns pending"
                  sub="1 over 48h SLA"
                  count={3}
                  href="/admin/returns"
                />
                <ActionRow
                  icon={PackageIcon}
                  tone="warning"
                  title="Low stock items"
                  sub="Re-order suggested"
                  count={8}
                  href="/admin/products"
                />
                <ActionRow
                  icon={Sparkles}
                  tone="info"
                  title="AI handoffs"
                  sub="Customer requested human"
                  count={2}
                  href="/admin/ai"
                />
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
              <RecentOrders />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
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
  delta?: string;
  trend?: "up" | "down";
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

function TimeToggle() {
  return (
    <div className="inline-flex p-0.5 bg-surface-2 rounded-md text-xs font-semibold">
      {["Day", "Week", "Month"].map((t, i) => (
        <button
          key={t}
          className={cn(
            "px-2.5 py-1 rounded-sm transition-colors",
            i === 0 ? "bg-surface shadow-sm text-fg" : "text-fg-muted",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function RevenueChart() {
  // Stable mock dataset
  const data = [
    42, 38, 45, 52, 48, 61, 55, 49, 58, 72, 68, 76, 82, 71, 79, 88, 84, 92, 86, 95, 103, 98, 107,
    112, 118, 124, 118, 127, 134, 142,
  ];
  const max = Math.max(...data);
  const w = 720;
  const h = 200;
  const pad = 16;
  const sx = (i: number) => pad + i * ((w - pad * 2) / (data.length - 1));
  const sy = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = data.map((v, i) => `${i ? "L" : "M"} ${sx(i)} ${sy(v)}`).join(" ");
  const area = `${line} L ${sx(data.length - 1)} ${h - pad} L ${sx(0)} ${h - pad} Z`;
  const last = data[data.length - 1]!;

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-[28px] font-bold tracking-tight tabular">₦68.4M</span>
        <span className="text-xs text-brand-accent font-bold inline-flex items-center gap-0.5">
          <ArrowUp className="size-3" strokeWidth={3} /> 18.2%
        </span>
        <span className="text-xs text-fg-muted">vs previous 30 days</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <defs>
          <linearGradient id="rev-g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--brand-primary))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(var(--brand-primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad}
            x2={w - pad}
            y1={pad + f * (h - pad * 2)}
            y2={pad + f * (h - pad * 2)}
            stroke="hsl(var(--border))"
            strokeDasharray="2 4"
          />
        ))}
        <path d={area} fill="url(#rev-g)" />
        <path
          d={line}
          fill="none"
          stroke="hsl(var(--brand-primary))"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle
          cx={sx(data.length - 1)}
          cy={sy(last)}
          r="5"
          fill="hsl(var(--brand-primary))"
          stroke="hsl(var(--surface))"
          strokeWidth="2"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-fg-muted mt-1 px-4">
        {["Dec 16", "Dec 23", "Dec 30", "Jan 6", "Jan 13"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </div>
  );
}

function Donut() {
  const data = [
    { label: "Processing", value: 38, color: "hsl(262 83% 58%)" },
    { label: "Confirmed", value: 24, color: "hsl(var(--brand-primary))" },
    { label: "Shipped", value: 18, color: "hsl(190 90% 48%)" },
    { label: "Delivered", value: 14, color: "hsl(var(--brand-accent))" },
    { label: "Pending", value: 6, color: "hsl(var(--warning))" },
  ];
  const total = data.reduce((a, d) => a + d.value, 0);
  let cumul = 0;
  const r = 60;
  const c = 80;
  const cir = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-4">
      <svg width="160" height="160" viewBox="0 0 160 160" className="flex-shrink-0">
        <circle cx={c} cy={c} r={r} fill="none" stroke="hsl(var(--surface-2))" strokeWidth="20" />
        {data.map((d, i) => {
          const len = (d.value / total) * cir;
          const off = (-cumul / total) * cir;
          cumul += d.value;
          return (
            <circle
              key={i}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth="20"
              strokeDasharray={`${len} ${cir}`}
              strokeDashoffset={off}
              transform="rotate(-90 80 80)"
            />
          );
        })}
        <text
          x={c}
          y={c - 4}
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill="hsl(var(--fg))"
        >
          {total}
        </text>
        <text x={c} y={c + 14} textAnchor="middle" fontSize="10" fill="hsl(var(--fg-muted))">
          orders
        </text>
      </svg>
      <div className="flex-1 flex flex-col gap-1.5 text-xs">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            <span className="flex-1">{d.label}</span>
            <span className="font-bold tabular">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
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

function RecentOrders() {
  const rows = ORDERS_LIST.slice(0, 6);
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
