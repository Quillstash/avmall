import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { RevenueRangePicker } from "@/components/admin/revenue-range-picker";
import { ProfitInsights } from "@/components/admin/profit-insights";
import { getProfitAnalysis, type ProfitAnalysis } from "@/lib/data/profit";
import { resolveRevenueRange, revenueReportArg } from "@/lib/data/reports";
import { getActiveAdminStoreId } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import { AlertTriangle, PackageX, Boxes, TrendingDown } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}

export default async function ProfitAnalysisPage({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const resolved = resolveRevenueRange(searchParams);
  const storeId = await getActiveAdminStoreId();
  const a = await getProfitAnalysis(revenueReportArg(resolved), storeId);
  const insightQuery = resolved.isCustom ? { from: resolved.from, to: resolved.to } : { range: resolved.presetRange };
  const periodLabel = `${fmtDay(a.from)} – ${fmtDay(a.to)}`;

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Profit Analysis" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Profit Analysis"
            subtitle={`Selling price − cost − discounts − expenses · ${periodLabel}`}
            actions={
              <RevenueRangePicker
                basePath="/admin/ai"
                activeRange={resolved.isCustom ? null : resolved.presetRange}
                from={resolved.from}
                to={resolved.to}
              />
            }
          />

          {/* Headline */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-3.5">
            <Stat label="Net Revenue" kobo={a.netRevenueKobo} sub={`${a.ordersCount} orders · ${a.unitsSold} units`} />
            <Stat label="Gross Profit" kobo={a.grossProfitKobo} sub="after cost of goods" />
            <Stat label="Net Profit" kobo={a.netProfitKobo} signed sub={a.marginPct == null ? "no sales" : `${a.marginPct.toFixed(1)}% margin`} />
            <Stat label="Discounts Given" kobo={a.discountKobo} tone="warn" sub="reduces profit" />
          </div>

          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-3.5 mb-3.5">
            {/* P&L chain */}
            <Card title="Profit & Loss">
              <PLRow label="Gross sales (selling price × qty)" kobo={a.grossSalesKobo} />
              <PLRow label="Discounts given" kobo={-a.discountKobo} minus />
              <PLRow label="Net revenue" kobo={a.netRevenueKobo} bold divider />
              <PLRow label="Cost of goods sold" kobo={-a.cogsKobo} minus />
              <PLRow label="Gross profit" kobo={a.grossProfitKobo} bold divider />
              <PLRow label="Operating expenses" kobo={-a.expensesKobo} minus />
              <PLRow label="Net profit" kobo={a.netProfitKobo} bold big divider signed />
              <div className="mt-3 rounded-md bg-surface-2 px-3 py-2.5 text-xs text-fg-muted">
                Discounts cost you <span className="font-bold text-warning">{formatMoney(a.discountKobo)}</span> this period —
                net profit would have been{" "}
                <span className="font-bold text-fg">{formatMoney(a.profitBeforeDiscountKobo)}</span> at full price.
              </div>
            </Card>

            {/* Stock analysis */}
            <Card title="Stock">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Inventory cost value" value={formatMoney(a.inventory.costKobo)} />
                <MiniStat label="Inventory retail value" value={formatMoney(a.inventory.retailKobo)} />
                <MiniStat label="Low stock" value={String(a.inventory.lowStock)} icon={<Boxes className="size-3.5 text-warning" />} />
                <MiniStat label="Out of stock" value={String(a.inventory.outOfStock)} icon={<PackageX className="size-3.5 text-danger" />} />
                <MiniStat label="Dead stock (unsold)" value={String(a.inventory.deadStock)} icon={<TrendingDown className="size-3.5 text-fg-muted" />} sub="in stock, 0 sales this period" span2 />
              </div>
              {a.expenseBreakdown.length > 0 && (
                <>
                  <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-1.5">Expenses by type</div>
                  <div className="flex flex-col gap-1">
                    {a.expenseBreakdown.slice(0, 6).map((e) => (
                      <div key={e.type} className="flex justify-between text-sm">
                        <span className="text-fg-muted">{e.type}</span>
                        <span className="font-semibold tabular">{formatMoney(e.amountKobo)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Product + category breakdown */}
          <div className="grid lg:grid-cols-2 gap-3.5 mb-3.5">
            <Card title="Most profitable products">
              <ProductTable rows={a.topProducts} />
            </Card>
            <Card title={a.lossProducts.length ? "Loss-making products (sold below cost)" : "Profit by category"}>
              {a.lossProducts.length ? (
                <ProductTable rows={a.lossProducts} loss />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {a.byCategory.slice(0, 9).map((c) => (
                    <div key={c.category} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-fg-muted">{c.category} · {c.unitsSold}u</span>
                      <span className={`font-bold tabular ${c.profitKobo < 0 ? "text-danger" : "text-fg"}`}>{formatMoney(c.profitKobo)}</span>
                    </div>
                  ))}
                  {a.byCategory.length === 0 && <Empty />}
                </div>
              )}
            </Card>
          </div>

          <ProfitInsights query={insightQuery} />
        </div>
      </div>
    </>
  );
}

function Stat({ label, kobo, sub, tone, signed }: { label: string; kobo: number; sub: string; tone?: "warn"; signed?: boolean }) {
  const color = signed && kobo < 0 ? "text-danger" : tone === "warn" ? "text-warning" : "text-fg";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{label}</div>
      <div className={`text-2xl font-bold tracking-tight mt-1.5 tabular ${color}`}>{formatMoney(kobo)}</div>
      <div className="text-[11px] text-fg-muted mt-0.5">{sub}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm min-w-0">
      <div className="px-4 py-3.5 text-sm font-bold">{title}</div>
      <div className="h-px bg-border" />
      <div className="p-4">{children}</div>
    </div>
  );
}

function PLRow({ label, kobo, minus, bold, big, divider, signed }: { label: string; kobo: number; minus?: boolean; bold?: boolean; big?: boolean; divider?: boolean; signed?: boolean }) {
  const color = signed && kobo < 0 ? "text-danger" : minus ? "text-fg-muted" : "text-fg";
  return (
    <div className={`flex items-center justify-between py-1.5 ${divider ? "border-t border-border mt-1 pt-2.5" : ""}`}>
      <span className={`${bold ? "font-bold" : "text-fg-muted"} text-sm`}>{label}</span>
      <span className={`tabular ${bold ? "font-bold" : "font-semibold"} ${big ? "text-lg" : "text-sm"} ${color}`}>{formatMoney(kobo)}</span>
    </div>
  );
}

function MiniStat({ label, value, sub, icon, span2 }: { label: string; value: string; sub?: string; icon?: React.ReactNode; span2?: boolean }) {
  return (
    <div className={`rounded-md bg-surface-2 p-3 ${span2 ? "col-span-2" : ""}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted">{icon}{label}</div>
      <div className="text-lg font-bold tabular mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-fg-subtle">{sub}</div>}
    </div>
  );
}

function ProductTable({ rows, loss }: { rows: ProfitAnalysis["topProducts"]; loss?: boolean }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="flex flex-col gap-1">
      {rows.map((p) => (
        <div key={p.slug ?? p.name} className="flex items-center justify-between gap-3 text-sm py-0.5">
          <span className="truncate flex-1 min-w-0">{p.name}</span>
          <span className="text-[11px] text-fg-muted tabular flex-shrink-0">{p.unitsSold}u</span>
          <span className={`font-bold tabular flex-shrink-0 w-24 text-right ${loss || p.profitKobo < 0 ? "text-danger" : "text-fg"}`}>{formatMoney(p.profitKobo)}</span>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex items-center gap-2 text-sm text-fg-muted py-6 justify-center">
      <AlertTriangle className="size-4" /> No sales in this period yet.
    </div>
  );
}
