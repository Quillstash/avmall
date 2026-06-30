import Link from "next/link";
import { ShoppingBag, Tag, Users, Plus, BadgePercent, Sparkles } from "lucide-react";
import { DonutChart } from "@/components/ui/charts";
import { formatMoney } from "@/lib/money";
import type { BusinessOverview, ChannelStat } from "@/lib/data/dashboard";

const ONLINE_GREEN = "hsl(var(--brand-accent))";
const OFFLINE_GREEN = "hsl(142 60% 78%)";

const CHANNEL_COLORS: Record<string, string> = {
  walkin: "hsl(262 83% 58%)",
  whatsapp: "hsl(142 70% 45%)",
  web: "hsl(0 72% 51%)",
  ai: "hsl(220 90% 56%)",
  phone: "hsl(38 92% 50%)",
};

export function BusinessOverviewSection({
  data,
  rangeLabel,
}: {
  data: BusinessOverview;
  rangeLabel: string;
}) {
  return (
    <div className="grid lg:grid-cols-[1.7fr_1fr] gap-3.5 mb-5">
      {/* LEFT — Business Overview */}
      <div className="rounded-lg border border-border bg-surface shadow-sm min-w-0">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Business Overview</h2>
              <p className="text-xs text-fg-muted mt-0.5">Here is how your business is doing</p>
            </div>
            <span className="text-[11px] font-semibold text-fg-muted rounded-md border border-border px-2.5 py-1">
              {rangeLabel}
            </span>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-2.5 mt-4">
            <Kpi tone="green" icon={<ShoppingBag className="size-4" />} value={data.ordersCount} label="Orders" />
            <Kpi tone="blue" icon={<Tag className="size-4" />} value={data.productsSold} label="Products sold" />
            <Kpi tone="amber" icon={<Users className="size-4" />} value={data.newCustomers} label="New Customers" />
          </div>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-border flex-1" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
              Overview of your business
            </span>
            <div className="h-px bg-border flex-1" />
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Total label="Total Sales" value={data.totalSalesKobo} />
            <Total label="Total Settled" value={data.settledKobo} />
            <Total label="Total Owed" value={data.owedKobo} />
            <Total label="Offline Sales" value={data.offlineSalesKobo} sub="walk-in + phone" />
          </div>

          {/* Monthly online vs offline */}
          <div className="mt-6">
            <MonthlyBars months={data.monthly} />
          </div>
        </div>
      </div>

      {/* RIGHT — channel donut + quick actions */}
      <div className="flex flex-col gap-3.5">
        <div className="rounded-lg border border-border bg-surface shadow-sm">
          <div className="px-4 py-3.5 text-sm font-bold">Top 5 Sales Channel</div>
          <div className="h-px bg-border" />
          <div className="p-4">
            <ChannelDonut channels={data.channels} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface shadow-sm">
          <div className="px-4 py-3.5 text-sm font-bold">Quick Actions</div>
          <div className="h-px bg-border" />
          <div className="p-2.5 flex flex-col gap-1.5">
            <QuickAction href="/admin/orders/new" icon={<ShoppingBag className="size-4" />} label="Create New Order" />
            <QuickAction href="/admin/products/new" icon={<Plus className="size-4" />} label="Add A New Product" />
            <QuickAction href="/admin/discounts" icon={<BadgePercent className="size-4" />} label="Run Sales" />
            <QuickAction href="/admin/ai" icon={<Sparkles className="size-4" />} label="Ask AI" />
          </div>
        </div>
      </div>
    </div>
  );
}

const TONE_BG: Record<string, string> = {
  green: "bg-success-bg text-success",
  blue: "bg-info-bg text-info",
  amber: "bg-warning-bg text-warning",
};

function Kpi({
  tone,
  icon,
  value,
  label,
}: {
  tone: "green" | "blue" | "amber";
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${TONE_BG[tone]}`}>
      <div className="flex items-start justify-between">
        <div className="text-2xl font-bold tabular leading-none">{value.toLocaleString("en-NG")}</div>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="text-xs font-semibold mt-1.5 opacity-90">{label}</div>
    </div>
  );
}

function Total({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">{label}</div>
      <div className="text-xl font-bold tracking-tight mt-1 tabular truncate" title={formatMoney(value)}>
        {formatMoney(value)}
      </div>
      {sub && <div className="text-[10px] text-fg-subtle mt-0.5">{sub}</div>}
    </div>
  );
}

function MonthlyBars({ months }: { months: BusinessOverview["monthly"] }) {
  const max = Math.max(1, ...months.map((m) => m.onlineKobo + m.offlineKobo));
  const hasData = months.some((m) => m.onlineKobo + m.offlineKobo > 0);
  if (!months.length || !hasData) {
    return (
      <div className="h-[180px] flex items-center justify-center text-sm text-fg-muted rounded-md bg-surface-2">
        No sales in this period yet — the chart fills in as orders come in.
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-end gap-1.5 h-[180px]">
        {months.map((m, i) => {
          const onlineH = (m.onlineKobo / max) * 100;
          const offlineH = (m.offlineKobo / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end h-full min-w-0"
              title={`${m.label}: ${formatMoney(m.onlineKobo + m.offlineKobo)} (online ${formatMoney(m.onlineKobo)}, offline ${formatMoney(m.offlineKobo)})`}
            >
              <div className="w-full rounded-t-sm" style={{ height: `${offlineH}%`, background: OFFLINE_GREEN }} />
              <div className="w-full" style={{ height: `${onlineH}%`, background: ONLINE_GREEN }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {months.map((m, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-fg-muted truncate">
            {m.label}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: ONLINE_GREEN }} /> Online Sales
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: OFFLINE_GREEN }} /> Offline Sales
        </span>
      </div>
    </div>
  );
}

function ChannelDonut({ channels }: { channels: ChannelStat[] }) {
  const total = channels.reduce((a, c) => a + c.count, 0);
  if (total === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-sm text-fg-muted">
        No orders yet.
      </div>
    );
  }
  const data = channels.map((c) => ({
    label: c.label,
    value: c.count,
    color: CHANNEL_COLORS[c.source] ?? "hsl(var(--fg-muted))",
  }));
  return (
    <DonutChart
      data={data}
      centerLabel={
        <>
          <div className="text-2xl font-bold tabular leading-none">{total}</div>
          <div className="text-[10px] text-fg-muted mt-0.5">orders</div>
        </>
      }
    />
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-semibold text-brand-accent hover:bg-surface-2 transition-colors"
    >
      <span className="text-brand-accent">{icon}</span>
      {label}
    </Link>
  );
}
