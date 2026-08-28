"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  FolderInput,
  Loader2,
  AlertTriangle,
  Upload,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { ExportCsvButton } from "@/components/admin/export-csv-button";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/money";
import { type StockStatus } from "@/components/ui/status-pill";
import { stockStatusFor, LOW_STOCK_THRESHOLD } from "@/lib/product-status";
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
import { Input } from "@/components/ui/input";
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
  return stockStatusFor(p);
}

/**
 * True when the product has at least one real uploaded image. `imageUrl` always
 * falls back to a seed/placeholder, so it can't be used to detect "no image" —
 * the reliable signal is whether any ProductImage rows resolved (`imageRecords`).
 */
function hasImage(p: Product): boolean {
  return (p.imageRecords?.length ?? 0) > 0;
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
  // Seed the category filter from the URL (?category=<slug>) so the Categories
  // page can deep-link straight into this list pre-filtered.
  const searchParams = useSearchParams();
  const [categoryValues, setCategoryValues] = React.useState<string[]>(() => {
    const c = searchParams.get("category");
    return c ? [c] : [];
  });
  const [statusValues, setStatusValues] = React.useState<string[]>([]);
  const [imageValues, setImageValues] = React.useState<string[]>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  const [categorizeOpen, setCategorizeOpen] = React.useState(false);
  const [chosenCategory, setChosenCategory] = React.useState("");
  const [newCatName, setNewCatName] = React.useState("");
  const [brandInput, setBrandInput] = React.useState("");
  const [categorizing, setCategorizing] = React.useState(false);
  const stockFileRef = React.useRef<HTMLInputElement>(null);
  const [importingStock, setImportingStock] = React.useState(false);

  const lowStock = products.filter(
    (p) => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD && !p.preorder,
  ).length;
  const outOfStock = products.filter((p) => p.stock === 0 && !p.preorder).length;
  const preorders = products.filter((p) => p.preorder).length;
  const missingImages = products.filter((p) => !hasImage(p)).length;

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
    {
      id: "image",
      label: "Images",
      values: imageValues,
      options: [
        { value: "missing", label: "Missing image" },
        { value: "has", label: "Has image" },
      ],
    },
  ];

  const filtered = React.useMemo(() => {
    const archivedSelected = statusValues.includes("archived");
    const stockFilters = statusValues.filter((s) => s !== "archived");
    const imageFilter = imageValues[0]; // "missing" | "has" | undefined
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
      if (imageFilter === "missing" && hasImage(p)) return false;
      if (imageFilter === "has" && !hasImage(p)) return false;
      return true;
    });
  }, [search, categoryValues, statusValues, imageValues, products]);

  // The list filters live in React state (the table is filtered in memory), so
  // the export can't read them off the URL the way the orders list does — it
  // reads them from here instead. The date range is added by the button.
  const exportParams = React.useMemo(() => {
    const p: Record<string, string> = {};
    if (search.trim()) p.q = search.trim();
    if (categoryValues.length > 0) p.category = categoryValues.join(",");
    if (statusValues.length > 0) p.stock = statusValues.join(",");
    if (imageValues[0]) p.image = imageValues[0];
    return p;
  }, [search, categoryValues, statusValues, imageValues]);

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;
  const selectedSlugs = React.useMemo(
    () =>
      filtered
        .filter((_, i) => (rowSelection as Record<string, boolean>)[i])
        .map((p) => p.slug),
    [filtered, rowSelection],
  );
  // Drafts among the selection — categorising them won't surface them on the
  // storefront or to the AI until they're published (the usual "0 in category").
  const selectedDrafts = React.useMemo(
    () =>
      filtered.filter(
        (p, i) => (rowSelection as Record<string, boolean>)[i] && !p.published && !p.archived,
      ).length,
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
    if (selectedSlugs.length === 0) return;
    const wantNew = chosenCategory === "__new__";
    const brandVal = brandInput.trim();
    if (wantNew && !newCatName.trim()) {
      toast.error("Enter the new category name");
      return;
    }
    if (!wantNew && !chosenCategory && !brandVal) {
      toast.error("Choose a category or set a brand");
      return;
    }
    setCategorizing(true);
    try {
      // Create the category first when staff typed a new one, then assign it.
      let categorySlug: string | undefined = wantNew ? undefined : chosenCategory || undefined;
      if (wantNew) {
        const cr = await fetch("/api/v1/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCatName.trim() }),
        });
        const cj = await cr.json();
        if (!cr.ok) {
          toast.error(cj?.error?.message ?? "Could not create category");
          return;
        }
        categorySlug = cj.data?.category?.slug;
      }
      const res = await fetch("/api/v1/admin/products/bulk-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slugs: selectedSlugs,
          ...(categorySlug && { categorySlug }),
          ...(brandVal && { brand: brandVal }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not update products");
        return;
      }
      const moved = json.data?.updated ?? 0;
      const bits: string[] = [];
      if (json.data?.category?.name) bits.push(`category “${json.data.category.name}”`);
      if (json.data?.brand) bits.push(`brand “${json.data.brand}”`);
      toast.success(
        `Updated ${moved} product${moved === 1 ? "" : "s"}${bits.length ? " → " + bits.join(" + ") : ""}`,
      );
      setCategorizeOpen(false);
      setChosenCategory("");
      setNewCatName("");
      setBrandInput("");
      setRowSelection({});
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setCategorizing(false);
    }
  }

  async function handleStockImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setImportingStock(true);
    try {
      const csv = await file.text();
      const res = await fetch("/api/v1/admin/products/bulk-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Stock import failed");
        return;
      }
      const d = json.data ?? {};
      const bits: string[] = [];
      if (d.notFound?.length) bits.push(`${d.notFound.length} not found`);
      if (d.multiVariant?.length) bits.push(`${d.multiVariant.length} multi-variant skipped`);
      if (d.invalid?.length) bits.push(`${d.invalid.length} invalid`);
      toast.success(
        `Updated stock for ${d.updated ?? 0} product${d.updated === 1 ? "" : "s"}` +
          (bits.length ? ` · ${bits.join(" · ")}` : ""),
      );
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setImportingStock(false);
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
            subtitle={`${products.length} products · ${lowStock} low stock · ${outOfStock} out of stock · ${missingImages} missing image${missingImages === 1 ? "" : "s"}`}
            actions={
              <>
                <ExportCsvButton
                  endpoint="/api/v1/admin/products/export"
                  params={exportParams}
                  hint="Leave blank for the full catalogue. With a date range you get only products that sold in the window, plus units and revenue — use the full export for Import stock."
                />
                <input
                  ref={stockFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleStockImport}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={importingStock}
                  onClick={() => stockFileRef.current?.click()}
                  title="Upload the exported CSV with the stock column filled in to set stock in bulk"
                >
                  {importingStock ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  Import stock
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
              if (id === "image") setImageValues(values);
            }}
            onClear={() => {
              setCategoryValues([]);
              setStatusValues([]);
              setImageValues([]);
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
            <DialogTitle>Set category &amp; brand</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-sm text-fg-muted">
              Update <span className="font-semibold text-fg">{selectedCount}</span> selected
              product{selectedCount === 1 ? "" : "s"}. Category and brand are what the storefront
              filters and the AI agent use to find them.
            </p>

            {selectedDrafts > 0 && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-warning-bg text-warning text-xs leading-relaxed">
                <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">{selectedDrafts}</span> of these{" "}
                  {selectedDrafts === 1 ? "is a draft" : "are drafts"}. Categorising won&apos;t make
                  {selectedDrafts === 1 ? " it" : " them"} show on the storefront or to the AI until
                  you <span className="font-semibold">publish</span>.
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">
                Category
              </div>
              <Select value={chosenCategory} onChange={(e) => setChosenCategory(e.target.value)}>
                <option value="">Keep current category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__new__">➕ New category…</option>
              </Select>
              {chosenCategory === "__new__" && (
                <Input
                  className="mt-2"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New category name, e.g. Power banks"
                  autoFocus
                />
              )}
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">
                Brand{" "}
                <span className="font-normal normal-case text-fg-subtle">(optional)</span>
              </div>
              <Input
                value={brandInput}
                onChange={(e) => setBrandInput(e.target.value)}
                placeholder="Set brand, e.g. Oraimo"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setCategorizeOpen(false)} disabled={categorizing}>
              Cancel
            </Button>
            <Button
              onClick={bulkCategorize}
              disabled={
                categorizing ||
                (!chosenCategory && !brandInput.trim()) ||
                (chosenCategory === "__new__" && !newCatName.trim())
              }
            >
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
