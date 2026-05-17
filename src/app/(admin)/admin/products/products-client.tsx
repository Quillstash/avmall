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
  Copy,
  Eye,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/money";
import { StockStatusPill, type StockStatus } from "@/components/ui/status-pill";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar, type FilterConfig } from "@/components/ui/filter-bar";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { CATEGORIES, type Product } from "@/lib/mock-data";

function statusFor(p: Product): StockStatus {
  if (p.preorder) return "preorder";
  if (p.stock === 0) return "out_of_stock";
  if (p.stock < 20) return "low_stock";
  return "in_stock";
}

interface Props {
  products: Product[];
}

export function ProductsListClient({ products }: Props) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [categoryValues, setCategoryValues] = React.useState<string[]>([]);
  const [statusValues, setStatusValues] = React.useState<string[]>([]);
  const [rowSelection, setRowSelection] = React.useState({});

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
      options: CATEGORIES.map((c) => ({ value: c.id, label: c.name })),
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
      ],
    },
  ];

  const filtered = React.useMemo(() => {
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
      if (statusValues.length > 0 && !statusValues.includes(statusFor(p))) return false;
      return true;
    });
  }, [search, categoryValues, statusValues]);

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

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
            <div className="font-semibold truncate hover:text-brand-primary">
              {row.original.name}
            </div>
            <div className="text-[11px] text-fg-muted">
              {row.original.brand} · {row.original.variants.length}{" "}
              variant{row.original.variants.length > 1 ? "s" : ""}
            </div>
          </div>
        </Link>
      ),
    },
    {
      id: "sku",
      header: "SKU",
      enableSorting: false,
      cell: ({ row }) => (
        <code className="font-mono text-[11px] text-fg-muted tabular">
          {row.original.brand.slice(0, 3).toUpperCase()}-{row.original.id.toUpperCase()}
        </code>
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
      accessorKey: "stock",
      header: () => <div className="text-right">Stock</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <div className="font-bold tabular">{row.original.stock}</div>
          <div className="text-[10px] text-fg-muted">
            {row.original.preorder ? `MOQ ${row.original.moq}` : "on hand"}
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StockStatusPill status={statusFor(row.original)} />,
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
              <DropdownMenuItem onClick={() => toast.success("Duplicated")}>
                <Copy className="size-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
            <StockCard label="Total products" value={String(products.length)} sub="across 5 categories" />
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
                    id: "archive",
                    label: "Archive",
                    icon: <Archive className="size-3.5" />,
                    onClick: () => toast.success(`Archived ${selectedCount}`),
                  },
                  {
                    id: "export",
                    label: "Export",
                    icon: <Download className="size-3.5" />,
                    onClick: () => toast.success(`Exporting ${selectedCount} products`),
                  },
                ]}
              />
            )}
          />
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
