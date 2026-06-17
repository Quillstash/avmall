import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Money } from "@/components/ui/money";
import { getInventoryReport } from "@/lib/data/reports";
import { getActiveAdminStoreId } from "@/lib/store";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function InventoryReportPage() {
  const storeId = await getActiveAdminStoreId();
  const data = await getInventoryReport(storeId);
  const projectedProfit = data.totalRetailKobo - data.totalCostKobo;

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Reports", href: "/admin/reports" },
          { label: "Inventory & profit" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1200px] mx-auto">
          <PageHeader
            title="Inventory & profit"
            subtitle="Stock value, low-stock alerts, projected margin"
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
            <KpiCard label="SKUs" value={String(data.totalSkus)} sub="active products" />
            <KpiCard
              label="Out of stock"
              value={String(data.outOfStock)}
              sub="reorder needed"
              {...(data.outOfStock > 0 && { tone: "danger" as const })}
            />
            <KpiCard
              label="Low stock"
              value={String(data.lowStock)}
              sub="≤ 5 units"
              {...(data.lowStock > 0 && { tone: "warning" as const })}
            />
            <KpiCard
              label="Margin"
              value={
                data.projectedMarginPct == null
                  ? "—"
                  : `${data.projectedMarginPct.toFixed(1)}%`
              }
              sub="across the catalogue"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-3.5 mb-5">
            <KpiCard
              label="Inventory cost"
              value={formatMoney(data.totalCostKobo)}
              sub="Σ cost × stock"
            />
            <KpiCard
              label="Inventory retail value"
              value={formatMoney(data.totalRetailKobo)}
              sub="Σ price × stock"
            />
            <KpiCard
              label="Projected profit"
              value={formatMoney(projectedProfit)}
              sub="if everything sells through"
            />
          </div>

          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Package className="size-4 text-fg-muted" />
              <h2 className="text-sm font-bold">Low-stock items</h2>
              <span className="text-xs text-fg-muted">
                · {data.lowStockRows.length} shown
              </span>
            </div>
            {data.lowStockRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-fg-muted">
                Nothing critical. All SKUs above the low-stock threshold.
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-surface-2">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <th className="text-left px-3.5 py-2">Product</th>
                    <th className="text-left px-3.5 py-2">Brand</th>
                    <th className="text-right px-3.5 py-2">Stock</th>
                    <th className="text-right px-3.5 py-2">Cost</th>
                    <th className="text-right px-3.5 py-2">Retail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStockRows.map((r) => (
                    <tr key={r.slug} className="border-t border-border hover:bg-surface-2">
                      <td className="px-3.5 py-2.5">
                        <Link
                          href={`/admin/products/${r.slug}`}
                          className="font-semibold hover:text-brand-primary"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-fg-muted">{r.brand}</td>
                      <td className="px-3.5 py-2.5 text-right tabular font-bold text-warning">
                        {r.stock}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <Money kobo={r.costKobo} />
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <Money kobo={r.priceKobo} className="font-bold" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
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
  value: string;
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
