import Image from "next/image";
import Link from "next/link";
import { Plus, Download, Search, ChevronDown, MoreHorizontal } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { StockStatusPill, type StockStatus } from "@/components/ui/status-pill";
import { PRODUCTS } from "@/lib/mock-data";

const FILTERS = [
  "Category: All",
  "Status: Published",
  "Availability: Any",
  "Tags: Any",
] as const;

function statusFor(p: typeof PRODUCTS[number]): StockStatus {
  if (p.preorder) return "preorder";
  if (p.stock === 0) return "out_of_stock";
  if (p.stock < 20) return "low_stock";
  return "in_stock";
}

export default function AdminProductsListPage() {
  const lowStock = PRODUCTS.filter((p) => p.stock > 0 && p.stock < 20 && !p.preorder).length;
  const outOfStock = PRODUCTS.filter((p) => p.stock === 0 && !p.preorder).length;
  const preorders = PRODUCTS.filter((p) => p.preorder).length;

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Products" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Products"
            subtitle={`${PRODUCTS.length} products · ${lowStock} low stock · ${outOfStock} out of stock`}
            actions={
              <>
                <Button variant="secondary" size="sm">
                  <Download className="size-3.5" /> Import / Export
                </Button>
                <Link href="/admin/products/new">
                  <Button size="sm">
                    <Plus className="size-3.5" /> Add product
                  </Button>
                </Link>
              </>
            }
          />

          {/* Stock summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
            <StockCard label="Total products" value={String(PRODUCTS.length)} sub="across 5 categories" />
            <StockCard label="Low stock" value={String(lowStock)} sub="below threshold" tone="warning" />
            <StockCard label="Out of stock" value={String(outOfStock)} sub="needs reorder" tone="danger" />
            <StockCard label="Pre-order" value={String(preorders)} sub="awaiting batches" tone="info" />
          </div>

          {/* Filter bar */}
          <div className="rounded-lg border border-border bg-surface p-3 mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 h-9 bg-surface-2 rounded-md text-sm text-fg-muted flex-1 min-w-[200px]">
              <Search className="size-4" />
              <span>Name, SKU, brand…</span>
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
                    <th className="text-left px-3.5 py-2.5">Product</th>
                    <th className="text-left px-3.5 py-2.5">SKU</th>
                    <th className="text-left px-3.5 py-2.5">Category</th>
                    <th className="text-right px-3.5 py-2.5">Price</th>
                    <th className="text-right px-3.5 py-2.5">Stock</th>
                    <th className="text-left px-3.5 py-2.5">Status</th>
                    <th className="text-left px-3.5 py-2.5">Updated</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {PRODUCTS.map((p, i) => {
                    const status = statusFor(p);
                    return (
                      <tr key={p.id} className="border-t border-border hover:bg-surface-2">
                        <td className="px-3.5 py-3">
                          <input type="checkbox" className="accent-brand-primary" />
                        </td>
                        <td className="px-3.5 py-3">
                          <Link
                            href={`/admin/products/${p.slug}`}
                            className="flex items-center gap-2.5"
                          >
                            <div
                              className="relative size-10 rounded-md overflow-hidden flex-shrink-0"
                              style={{ background: p.bg }}
                            >
                              <Image
                                src={p.imageUrl}
                                alt={p.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold truncate hover:text-brand-primary">
                                {p.name}
                              </div>
                              <div className="text-[11px] text-fg-muted">
                                {p.brand} · {p.variants.length}{" "}
                                variant{p.variants.length > 1 ? "s" : ""}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-3.5 py-3 font-mono text-[11px] text-fg-muted tabular">
                          {p.brand.slice(0, 3).toUpperCase()}-{p.id.toUpperCase()}
                        </td>
                        <td className="px-3.5 py-3 capitalize text-fg-muted">{p.category}</td>
                        <td className="px-3.5 py-3 text-right">
                          <Money
                            kobo={p.saleActive && p.sale != null ? p.sale : p.price}
                            className="font-bold"
                          />
                          {p.saleActive && p.sale != null && (
                            <Money
                              kobo={p.price}
                              variant="strikethrough"
                              className="block text-[11px]"
                            />
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <div className="font-bold tabular">{p.stock}</div>
                          <div className="text-[10px] text-fg-muted">
                            {p.preorder ? `MOQ ${p.moq}` : "on hand"}
                          </div>
                        </td>
                        <td className="px-3.5 py-3">
                          <StockStatusPill status={status} />
                        </td>
                        <td className="px-3.5 py-3 text-xs text-fg-muted">
                          {["2h ago", "yesterday", "3d ago", "1w ago"][i % 4]}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StockCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "warning" | "danger" | "info";
}) {
  const valColor = tone === "warning"
    ? "text-warning"
    : tone === "danger"
      ? "text-danger"
      : tone === "info"
        ? "text-info"
        : "text-fg";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{label}</div>
      <div className={`text-2xl font-bold tabular mt-1 ${valColor}`}>{value}</div>
      <div className="text-[11px] text-fg-muted mt-0.5">{sub}</div>
    </div>
  );
}
