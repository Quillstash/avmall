"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Download,
  MoreHorizontal,
  Trash2,
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  FolderInput,
  Loader2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/money";
import { type StockStatus } from "@/components/ui/status-pill";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar, type FilterConfig } from "@/components/ui/filter-bar";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { type Category, type Product } from "@/lib/mock-data";

function statusFor(p: Product): StockStatus {
  if (p.preorder) return "preorder";
  if (p.stock === 0) return "out_of_stock";
  if (p.stock < 20) return "low_stock";
  return "in_stock";
}

const DATE_FMT = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
});
function fmtDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

interface Props {
  products: Product[];
  categories: Category[];
}

export function ProductsListClient({ products, categories }: Props) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [categoryValues, setCategoryValues] = React.useState<string[]>([]);
  const [statusValues, setStatusValues] = React.useState<string[]>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  const [categorizeOpen, setCategorizeOpen] = React.useState(false);
  const [chosenCategory, setChosenCategory] = React.useState("");
  const [categorizing, setCategorizing] = React.useState(false);

  const lowStock = products.filter((p) => p.stock > 0 && p.stock < 20 && !p.preorder).length;
  const outOfStock = products.filter((p) => p.stock === 0 && !p.preorder).length;
  const preorders = products.filter((p) => p.preorder).length;

  // Inventory value aggregates — summed only over in-stock products since the
  // user asked for "total ... of all goods in stock".
  const inStock = products.filter((p) => p.stock > 0);
  const totalCostKobo = inStock.reduce((a, p) => a + p.cost * p.stock, 0);
  const totalRetailKobo = inStock.reduce((a, p) => a + p.price * p.stock, 0);
  const projectedProfitKobo = totalRetailKobo - totalCostKobo;
  const projectedMarginPct =
    totalCostKobo > 0 ? (projectedProfitKobo / totalCostKobo) * 100 : null;

  const filters: FilterConfig[] = [
    {
      id: "category",
      label: "Category",
      values: categoryValues,
      multi: true,
      options: categories.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      id: "status",
      label: "Availability",
      values: statusValues,
      multi: true,
      options: [
        { value: "in_stock", label: "In stock" },
        { value: "low_stock", label: "Low stock" },
        { value: "out_of_stock", label: "Out of stock" },
        { value: "preorder", label: "Pre-order" },
        { value: "archived", label: "Archived" },
      ],
    },
  ];

  const filtered = React.useMemo(() => {
    const archivedSelected = statusValues.includes("archived");
    const stockFilters = statusValues.filter((s) => s !== "archived");
    return products.filter((p) => {
      if (
        search &&
        ![p.name, p.brand, p.id]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      if (categoryValues.length > 0 && !categoryValues.includes(p.category)) return false;
      // Archived products stay out of the active list unless explicitly shown.
      if (p.archived && !archivedSelected) return false;
      // "Archived" selected on its own → show only archived products.
      if (!p.archived && archivedSelected && stockFilters.length === 0) return false;
      if (stockFilters.length > 0 && !stockFilters.includes(statusFor(p))) return false;
      return true;
    });
  }, [search, categoryValues, statusValues, products]);

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;
  const selectedSlugs = React.useMemo(
    () =>
      filtered
        .filter((_, i) => (rowSelection as Record<string, boolean>)[i])
        .map((p) => p.slug),
    [filtered, rowSelection],
  );

  async function bulkArchive() {
    if (selectedSlugs.length === 0) return;
    if (!confirm(`Archive ${selectedSlugs.length} products? They'll be hidden from the storefront.`)) {
      return;
    }
    const results = await Promise.allSettled(
      selectedSlugs.map((slug) =>
        fetch(`/api/v1/admin/products/${encodeURIComponent(slug)}/archive`, {
          method: "POST",
        }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    toast.success(`Archived ${ok} / ${selectedSlugs.length}`);
    setRowSelection({});
    router.refresh();
  }

  async function bulkCategorize() {
    if (selectedSlugs.length === 0 || !chosenCategory) return;
    setCategorizing(true);
    try {
      const res = await fetch("/api/v1/admin/products/bulk-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: selectedSlugs, categorySlug: chosenCategory }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not set category");
        return;
      }
      const catName = json.data?.category?.name ?? "category";
      const moved = json.data?.updated ?? 0;
      toast.success(`Moved ${moved} product${moved === 1 ? "" : "s"} to ${catName}`);
      setCategorizeOpen(false);
      setChosenCategory("");
      setRowSelection({});
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setCategorizing(false);
    }
  }

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => (
        <Link
          href={`/admin/products/${row.original.slug}`}
          className="flex items-center gap-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative size-10 rounded-md overflow-hidden flex-shrink-0"
            style={{ background: row.original.bg }}
          >
            <Image
              src={row.original.imageUrl}
              alt={row.original.name}
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate hover:text-brand-primary inline-flex items-center gap-1.5">
              {row.original.name}
              {row.original.archived && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-fg-muted">
                  Archived
                </span>
              )}
            </div>
            <div className="text-[11px] text-fg-muted">{row.original.brand}</div>
          </div>
        </Link>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="capitalize text-fg-muted">{row.original.category}</span>
      ),
    },
    {
      accessorKey: "stock",
      header: () => <div className="text-right">In Stock</div>,
      cell: ({ row }) => {
        const s = row.original.stock;
        const tone = row.original.preorder
          ? "text-fg-muted"
          : s === 0
            ? "text-danger"
            : s < 20
              ? "text-warning"
              : "text-fg";
        return (
          <div className={`text-right font-bold tabular ${tone}`}>
            {row.original.preorder ? `MOQ ${row.original.moq ?? 1}` : s}
          </div>
        );
      },
    },
    {
      accessorKey: "price",
      header: () => <div className="text-right">Price</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Money
            kobo={row.original.saleActive && row.original.sale != null ? row.original.sale : row.original.price}
            className="font-bold"
          />
          {row.original.saleActive && row.original.sale != null && (
            <Money
              kobo={row.original.price}
              variant="strikethrough"
              className="block text-[11px]"
            />
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <PublishPill product={row.original} />,
    },
    {
      accessorKey: "createdAt",
      header: "Added",
      cell: ({ row }) => (
        <span className="text-[13px] text-fg-muted tabular whitespace-nowrap">
          {fmtDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface"
                aria-label="Row actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/admin/products/${row.original.slug}`)}
              >
                <Eye className="size-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const res = await fetch(
                    `/api/v1/admin/products/${row.original.slug}/duplicate`,
                    { method: "POST" },
                  );
                  if (res.status === 503) {
                    toast.error("Database required to duplicate products");
                    return;
                  }
                  const json = await res.json();
                  if (!res.ok) {
                    toast.error(json?.error?.message ?? "Could not duplicate");
                    return;
                  }
                  toast.success(`Duplicated as "${json.data.name}"`);
                  router.push(`/admin/products/${json.data.slug}`);
                }}
              >
                <Copy className="size-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {row.original.archived ? (
                <DropdownMenuItem
                  onClick={async () => {
                    const res = await fetch(
                      `/api/v1/admin/products/${row.original.slug}/archive`,
                      { method: "DELETE" },
                    );
                    if (res.status === 404 || res.status === 503) {
                      toast.success("Unarchived (local)");
                    } else if (res.ok) {
                      toast.success("Unarchived");
                      router.refresh();
                    } else {
                      const p = await res.json();
                      toast.error(p.error?.message ?? "Failed");
                    }
                  }}
                >
                  <ArchiveRestore className="size-3.5" /> Unarchive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={async () => {
                    const res = await fetch(
                      `/api/v1/admin/products/${row.original.slug}/archive`,
                      { method: "POST" },
                    );
                    if (res.status === 404 || res.status === 503) {
                      toast.success("Archived (local)");
                    } else if (res.ok) {
                      toast.success("Archived");
                      router.refresh();
                    } else {
                      const p = await res.json();
                      toast.error(p.error?.message ?? "Failed");
                    }
                  }}
                >
                  <Archive className="size-3.5" /> Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                destructive
                onClick={async () => {
                  const res = await fetch(
                    `/api/v1/admin/products/${row.original.slug}`,
                    { method: "DELETE" },
                  );
                  if (res.status === 404 || res.status === 503) {
                    toast.success("Deleted (local)");
                  } else if (res.ok) {
                    toast.success("Deleted");
                    router.refresh();
                  } else {
                    const p = await res.json();
                    toast.error(p.error?.message ?? "Failed");
                  }
                }}
              >
                <Trash2 className="size-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Products" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Products"
            subtitle={`${products.length} products · ${lowStock} low stock · ${outOfStock} out of stock`}
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-3.5">
            <StockCard
              label="Total products"
              value={String(products.length)}
              sub={`across ${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
            />
            <StockCard label="Low stock" value={String(lowStock)} sub="below threshold" tone="warning" />
            <StockCard label="Out of stock" value={String(outOfStock)} sub="needs reorder" tone="danger" />
            <StockCard label="Pre-order" value={String(preorders)} sub="awaiting batches" tone="info" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 mb-5">
            <StockCard
              label="Inventory cost"
              value={formatMoney(totalCostKobo)}
              sub={`${inStock.length} in-stock SKUs`}
            />
            <StockCard
              label="Inventory retail value"
              value={formatMoney(totalRetailKobo)}
              sub="sum of price × stock"
            />
            <StockCard
              label="Projected profit"
              value={formatMoney(projectedProfitKobo)}
              sub={
                projectedMarginPct == null
                  ? "no cost data"
                  : `${projectedMarginPct >= 0 ? "+" : ""}${projectedMarginPct.toFixed(1)}% margin`
              }
              tone="info"
            />
          </div>

          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Name, SKU, brand…"
            filters={filters}
            onFilterChange={(id, values) => {
              if (id === "category") setCategoryValues(values);
              if (id === "status") setStatusValues(values);
            }}
            onClear={() => {
              setCategoryValues([]);
              setStatusValues([]);
            }}
            className="mb-4"
          />

          <DataTable
            columns={columns}
            data={filtered}
            defaultSorting={[{ id: "createdAt", desc: true }]}
            enableSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onRowClick={(row) => router.push(`/admin/products/${row.slug}`)}
            toolbar={(table) => (
              <BulkActionsBar
                count={selectedCount}
                onClear={() => table.resetRowSelection()}
                actions={[
                  {
                    id: "categorize",
                    label: "Set category",
                    icon: <FolderInput className="size-3.5" />,
                    onClick: () => setCategorizeOpen(true),
                  },
                  {
                    id: "archive",
                    label: "Archive",
                    icon: <Archive className="size-3.5" />,
                    onClick: bulkArchive,
                  },
                ]}
              />
            )}
          />
        </div>
      </div>

      {/* Bulk "Set category" — assign every selected product to one category so
          the storefront filters and the AI agent surface them by category. */}
      <Dialog open={categorizeOpen} onOpenChange={(o) => !categorizing && setCategorizeOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set category</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-sm text-fg-muted">
              Move{" "}
              <span className="font-semibold text-fg">{selectedCount}</span> selected
              product{selectedCount === 1 ? "" : "s"} into one category. This is what the
              storefront filters and the AI agent use to find them.
            </p>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">
                Category
              </div>
              <Select
                value={chosenCategory}
                onChange={(e) => setChosenCategory(e.target.value)}
                autoFocus
              >
                <option value="">Choose a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setCategorizeOpen(false)} disabled={categorizing}>
              Cancel
            </Button>
            <Button onClick={bulkCategorize} disabled={categorizing || !chosenCategory}>
              {categorizing && <Loader2 className="size-4 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Publish-state pill (Published / Draft / Archived) — mirrors the Bumpa layout. */
function PublishPill({ product }: { product: Product }) {
  const { label, cls } = product.archived
    ? { label: "Archived", cls: "bg-surface-2 text-fg-muted" }
    : product.published
      ? { label: "Published", cls: "bg-success-bg text-success" }
      : { label: "Draft", cls: "bg-warning-bg text-warning" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
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
  const valColor =
    tone === "warning"
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
