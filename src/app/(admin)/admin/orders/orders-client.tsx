"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Download,
  MoreHorizontal,
  MessageCircle,
  Printer,
  XCircle,
  Eye,
  CheckCircle,
  Package,
  Truck,
  MapPin,
  Pencil,
  Loader2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { OrderStatusPill, PaymentStatusPill } from "@/components/ui/status-pill";
import { DataTable } from "@/components/ui/data-table";
import { SavedViewBar, type SavedView } from "@/components/ui/saved-view-bar";
import { FilterBar, type FilterConfig } from "@/components/ui/filter-bar";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import { Pagination } from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { waLink } from "@/lib/contact-links";
import { cn } from "@/lib/utils";
import { type OrderListRow } from "@/lib/admin-mock-data";
import { ORDER_SOURCES, ORDER_SOURCE_LABELS, type OrderSource } from "@/lib/order-source";

const PAYMENT_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
];
const SOURCE_OPTIONS = ORDER_SOURCES.map((s) => ({ value: s.value, label: s.label }));

// Forward-only status flow for the bulk "Edit status" dialog. Rank mirrors the
// server's STATUS_RANK so we can show, before applying, how many of the
// selected orders can actually move — the API rejects backward / same-status
// moves with a 409.
const STATUS_RANK: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
};
const BULK_STATUS_FLOW = [
  { value: "confirmed", label: "Confirmed", icon: CheckCircle },
  { value: "processing", label: "Processing", icon: Package },
  { value: "shipped", label: "Shipped", icon: Truck },
  { value: "delivered", label: "Delivered", icon: MapPin },
] as const;

/**
 * Rows-per-page choices in the pager. The first is the default; the server
 * page validates `?size=` against this list. Kept here beside the selector
 * that renders it — the page imports it back for validation.
 */
export const PAGE_SIZES = [25, 50, 100] as const;

interface Props {
  orders: OrderListRow[];
  /** Orders matching the active filters (drives the pager). */
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
  allCount: number;
  filters: {
    status: string;
    payment: string[];
    source: string[];
    search: string;
    /** `YYYY-MM-DD`, or "" when unset. */
    from: string;
    to: string;
  };
}

export function OrdersListClient({
  orders,
  total,
  page,
  pageSize,
  statusCounts,
  allCount,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state lives in the URL (server-driven); these mirror the current
  // query so the controls stay in sync.
  const view = filters.status || "all";
  const paymentValues = filters.payment;
  const sourceValues = filters.source;

  // Local, debounced mirror of the search term so typing is instant but only
  // re-queries the server after a short pause.
  const [search, setSearch] = React.useState(filters.search);
  React.useEffect(() => setSearch(filters.search), [filters.search]);

  const [rowSelection, setRowSelection] = React.useState({});
  const [cancelTarget, setCancelTarget] = React.useState<OrderListRow | null>(null);
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [statusLoading, setStatusLoading] = React.useState<string | null>(null);
  const [bulkStatusOpen, setBulkStatusOpen] = React.useState(false);
  const [bulkStatusValue, setBulkStatusValue] = React.useState<string>("");
  const [bulkStatusLoading, setBulkStatusLoading] = React.useState(false);

  // Write filter/page state to the URL; the (force-dynamic) server page then
  // re-renders with a fresh batch of rows. Filter changes reset to page 1;
  // explicit page changes keep the rest of the query.
  const setParams = React.useCallback(
    (next: Record<string, string | string[] | null>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());
      if (resetPage) params.delete("page");
      for (const [key, val] of Object.entries(next)) {
        params.delete(key);
        if (Array.isArray(val)) {
          if (val.length > 0) params.set(key, val.join(","));
        } else if (val) {
          params.set(key, val);
        }
      }
      // Clear the selection when the underlying set changes.
      setRowSelection({});
      const qs = params.toString();
      router.push(qs ? `/admin/orders?${qs}` : "/admin/orders");
    },
    [router, searchParams],
  );

  // Debounce the search box → URL.
  React.useEffect(() => {
    if (search === filters.search) return;
    const t = setTimeout(() => setParams({ q: search || null }), 350);
    return () => clearTimeout(t);
  }, [search, filters.search, setParams]);

  // A bookmarked ?page=99, or a filter that shrank the result set, can strand
  // the viewer past the last page — an empty table with no obvious way back.
  // Walk them to the last real page instead.
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  React.useEffect(() => {
    if (page > totalPages) setParams({ page: String(totalPages) }, false);
  }, [page, totalPages, setParams]);

  // The export mirrors the screen: same filters, same date window, same store.
  // `page`/`size` are dropped — they page the view, they don't narrow the set.
  const exportHref = React.useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("size");
    const qs = params.toString();
    return qs
      ? `/api/v1/admin/orders/export?${qs}`
      : "/api/v1/admin/orders/export";
  }, [searchParams]);

  const filterConfigs: FilterConfig[] = [
    { id: "payment", label: "Payment", values: paymentValues, options: PAYMENT_OPTIONS, multi: true },
    { id: "source", label: "Source", values: sourceValues, options: SOURCE_OPTIONS, multi: true },
  ];

  // Order-status quick filters — "All" plus one tab per status. Counts come
  // from the server, spanning the whole matching set (not just this page).
  const savedViews: SavedView[] = React.useMemo(() => {
    const STATUSES = [
      { id: "pending", label: "Pending" },
      { id: "confirmed", label: "Confirmed" },
      { id: "processing", label: "Processing" },
      { id: "shipped", label: "Shipped" },
      { id: "delivered", label: "Delivered" },
      { id: "cancelled", label: "Cancelled" },
      { id: "refunded", label: "Refunded" },
    ];
    return [
      { id: "all", label: "All", count: allCount },
      ...STATUSES.map((s) => ({ id: s.id, label: s.label, count: statusCounts[s.id] ?? 0 })),
    ];
  }, [statusCounts, allCount]);

  // Server already filtered + paginated — render the batch as-is.
  const filtered = orders;

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;
  const selectedNumbers = React.useMemo(
    () =>
      filtered
        .filter((_, i) => (rowSelection as Record<string, boolean>)[i])
        .filter((o) => o.status !== "cancelled" && o.status !== "shipped" && o.status !== "delivered")
        .map((o) => o.number),
    [filtered, rowSelection],
  );

  // Every selected row, whatever its status — the bulk status dialog narrows
  // these to the ones that can actually move to the chosen status.
  const selectedRows = React.useMemo(
    () => filtered.filter((_, i) => (rowSelection as Record<string, boolean>)[i]),
    [filtered, rowSelection],
  );
  const bulkEligible = React.useMemo(() => {
    if (!bulkStatusValue) return [];
    const targetRank = STATUS_RANK[bulkStatusValue] ?? 0;
    return selectedRows.filter(
      (o) => o.status !== "cancelled" && (STATUS_RANK[o.status] ?? 0) < targetRank,
    );
  }, [selectedRows, bulkStatusValue]);

  async function changeStatus(number: string, status: string) {
    setStatusLoading(number);
    try {
      const res = await fetch(`/api/v1/admin/orders/${encodeURIComponent(number)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not update status");
        return;
      }
      toast.success(`Order ${number} → ${status}`);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setStatusLoading(null);
    }
  }

  async function bulkCancel() {
    if (selectedNumbers.length === 0) {
      toast.error("Nothing to cancel — selection contains no cancellable orders.");
      return;
    }
    if (!confirm(`Cancel ${selectedNumbers.length} order${selectedNumbers.length === 1 ? "" : "s"}? Stock reservations are released.`)) {
      return;
    }
    const results = await Promise.allSettled(
      selectedNumbers.map((n) =>
        fetch(`/api/v1/admin/orders/${encodeURIComponent(n)}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Bulk cancellation by staff" }),
        }),
      ),
    );
    const ok = results.filter(
      (r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<Response>).value.ok,
    ).length;
    toast.success(`Cancelled ${ok} / ${selectedNumbers.length}`);
    setRowSelection({});
    router.refresh();
  }

  async function applyBulkStatus() {
    if (!bulkStatusValue || bulkEligible.length === 0) return;
    setBulkStatusLoading(true);
    try {
      const results = await Promise.allSettled(
        bulkEligible.map((o) =>
          fetch(`/api/v1/admin/orders/${encodeURIComponent(o.number)}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: bulkStatusValue }),
          }),
        ),
      );
      const ok = results.filter(
        (r) =>
          r.status === "fulfilled" &&
          (r as PromiseFulfilledResult<Response>).value.ok,
      ).length;
      if (ok === bulkEligible.length) {
        toast.success(`Updated ${ok} order${ok === 1 ? "" : "s"} → ${bulkStatusValue}`);
      } else {
        toast.error(
          `Updated ${ok} / ${bulkEligible.length} — ${bulkEligible.length - ok} couldn't be changed`,
        );
      }
      setBulkStatusOpen(false);
      setRowSelection({});
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBulkStatusLoading(false);
    }
  }

  const columns: ColumnDef<OrderListRow>[] = [
    {
      accessorKey: "number",
      header: "Order",
      cell: ({ row }) => (
        <Link
          href={`/admin/orders/${row.original.number}`}
          className="font-mono text-xs font-bold tabular hover:text-brand-primary"
        >
          #{row.original.number}
        </Link>
      ),
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{row.original.customerName}</span>
            {!row.original.customerEmail && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-surface-2 text-fg-muted">
                Guest
              </span>
            )}
          </div>
          <div className="text-[11px] text-fg-muted font-mono tabular">
            {row.original.customerPhone}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "items",
      header: () => <div className="text-right">Items</div>,
      cell: ({ row }) => <div className="text-right tabular">{row.original.items}</div>,
    },
    {
      accessorKey: "totalKobo",
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Money kobo={row.original.totalKobo} className="font-bold" />
          <div className="mt-0.5">
            <PaymentStatusPill status={row.original.payment} bare />
          </div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <OrderStatusPill status={row.original.status} />
          {row.original.returnState !== "none" && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-danger-bg text-danger whitespace-nowrap">
              {row.original.returnState === "full" ? "Returned" : "Part. ret."}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "source",
      header: "Source",
      enableSorting: false,
      cell: ({ row }) => <SourceChip source={row.original.source} />,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <div>
          <div className="text-xs text-fg-muted">{row.original.createdAt}</div>
          <div className="text-[10px] text-fg-subtle">by {row.original.createdBy}</div>
        </div>
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
              <DropdownMenuItem onClick={() => router.push(`/admin/orders/${row.original.number}`)}>
                <Eye className="size-3.5" /> View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Status transitions — only show the valid next step */}
              {row.original.status === "pending" && (
                <DropdownMenuItem
                  disabled={statusLoading === row.original.number}
                  onClick={() => changeStatus(row.original.number, "confirmed")}
                >
                  <CheckCircle className="size-3.5 text-brand-primary" /> Confirm order
                </DropdownMenuItem>
              )}
              {row.original.status === "confirmed" && (
                <DropdownMenuItem
                  disabled={statusLoading === row.original.number}
                  onClick={() => changeStatus(row.original.number, "processing")}
                >
                  <Package className="size-3.5 text-status-processing" /> Mark processing
                </DropdownMenuItem>
              )}
              {row.original.status === "processing" && (
                <DropdownMenuItem
                  disabled={statusLoading === row.original.number}
                  onClick={() => changeStatus(row.original.number, "shipped")}
                >
                  <Truck className="size-3.5 text-status-shipped" /> Mark shipped
                </DropdownMenuItem>
              )}
              {row.original.status === "shipped" && (
                <DropdownMenuItem
                  disabled={statusLoading === row.original.number}
                  onClick={() => changeStatus(row.original.number, "delivered")}
                >
                  <MapPin className="size-3.5 text-success" /> Mark delivered
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  window.open(
                    waLink(
                      row.original.customerPhone,
                      `Hi ${row.original.customerName.split(" ")[0]}, this is Avmall about order #${row.original.number}.`,
                    ),
                    "_blank",
                  )
                }
              >
                <MessageCircle className="size-3.5" /> WhatsApp customer
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/admin/orders/${row.original.number}?print=1`)}
              >
                <Printer className="size-3.5" /> Print packing slip
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onClick={() => setCancelTarget(row.original)}
                disabled={
                  row.original.status === "cancelled" ||
                  row.original.status === "delivered" ||
                  row.original.status === "shipped"
                }
              >
                <XCircle className="size-3.5" /> Cancel order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Orders" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Orders"
            subtitle={`${total.toLocaleString()} order${total === 1 ? "" : "s"}${
              view !== "all" ||
              paymentValues.length ||
              sourceValues.length ||
              filters.search ||
              filters.from ||
              filters.to
                ? " matching"
                : ""
            }`}
            actions={
              <>
                <a href={exportHref} download>
                  <Button variant="secondary" size="sm">
                    <Download className="size-3.5" /> Export CSV
                  </Button>
                </a>
                <Link href="/admin/orders/new">
                  <Button size="sm">
                    <Plus className="size-3.5" /> New order
                  </Button>
                </Link>
              </>
            }
          />

          <SavedViewBar
            views={savedViews}
            activeId={view}
            onChange={(id) => setParams({ status: id === "all" ? null : id })}
            className="mb-4"
          />

          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Order #, customer, phone, product…"
            filters={filterConfigs}
            onFilterChange={(id, values) => {
              if (id === "payment") setParams({ payment: values });
              if (id === "source") setParams({ source: values });
            }}
            onClear={() =>
              setParams({
                payment: null,
                source: null,
                status: null,
                q: null,
                from: null,
                to: null,
              })
            }
            className="mb-3"
          />

          <DateRangeFilter
            from={filters.from}
            to={filters.to}
            onApply={(from, to) => setParams({ from: from || null, to: to || null })}
            onClear={() => setParams({ from: null, to: null })}
            className="mb-4"
          />

          <DataTable
            columns={columns}
            data={filtered}
            pageSize={pageSize}
            hidePagination
            enableSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onRowClick={(row) => router.push(`/admin/orders/${row.number}`)}
            toolbar={(table) => (
              <BulkActionsBar
                count={selectedCount}
                onClear={() => table.resetRowSelection()}
                actions={[
                  {
                    id: "status",
                    label: "Edit status",
                    icon: <Pencil className="size-3.5" />,
                    onClick: () => {
                      setBulkStatusValue("");
                      setBulkStatusOpen(true);
                    },
                  },
                  {
                    id: "cancel",
                    label: "Cancel orders",
                    icon: <XCircle className="size-3.5" />,
                    destructive: true,
                    onClick: bulkCancel,
                  },
                ]}
              />
            )}
          />

          {total > 0 && (
            <Pagination
              page={page}
              total={total}
              perPage={pageSize}
              onChange={(p) => setParams({ page: String(p) }, false)}
              perPageOptions={[...PAGE_SIZES]}
              // A bigger page can strand the viewer past the last page, so a
              // size change goes back to page 1.
              onPerPageChange={(n) => setParams({ size: String(n) })}
              className="mt-4"
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Cancel this order?"
        description={
          cancelTarget && (
            <>
              <span className="font-mono font-bold">#{cancelTarget.number}</span> for{" "}
              <span className="font-semibold">{cancelTarget.customerName}</span>. This releases stock
              reservations and notifies the customer. Audit log is preserved.
            </>
          )
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        loading={cancelLoading}
        onConfirm={async () => {
          if (!cancelTarget) return;
          setCancelLoading(true);
          try {
            const res = await fetch(
              `/api/v1/admin/orders/${encodeURIComponent(cancelTarget.number)}/cancel`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: "Cancelled by staff" }),
              },
            );
            const json = await res.json();
            if (!res.ok) {
              toast.error(json?.error?.message ?? "Could not cancel order");
              return;
            }
            toast.success(`Order ${cancelTarget.number} cancelled`);
            setCancelTarget(null);
            router.refresh();
          } catch {
            toast.error("Network error");
          } finally {
            setCancelLoading(false);
          }
        }}
      />

      {/* Bulk status editor */}
      <Dialog
        open={bulkStatusOpen}
        onOpenChange={(o) => {
          if (!bulkStatusLoading) setBulkStatusOpen(o);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Update status · {selectedRows.length} order
              {selectedRows.length === 1 ? "" : "s"}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">
                Move selected orders to
              </div>
              <div className="grid grid-cols-2 gap-2">
                {BULK_STATUS_FLOW.map((s) => {
                  const Icon = s.icon;
                  const active = bulkStatusValue === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setBulkStatusValue(s.value)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm font-semibold transition-colors",
                        active
                          ? "border-brand-primary bg-brand-primary/5 text-brand-primary"
                          : "border-border-strong hover:bg-surface-2",
                      )}
                    >
                      <Icon className="size-4" />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {bulkStatusValue && (
              <div
                className={cn(
                  "text-xs rounded-md p-2.5 leading-relaxed",
                  bulkEligible.length === 0
                    ? "bg-warning-bg text-warning"
                    : "bg-surface-2 text-fg-muted",
                )}
              >
                {bulkEligible.length === 0 ? (
                  <>
                    None of the selected orders can move to{" "}
                    <span className="font-semibold">{bulkStatusValue}</span> — they're
                    already there, further along, or cancelled.
                  </>
                ) : (
                  <>
                    <span className="font-bold text-fg">{bulkEligible.length}</span> of{" "}
                    {selectedRows.length} will move to{" "}
                    <span className="font-semibold">{bulkStatusValue}</span>.
                    {selectedRows.length - bulkEligible.length > 0 && (
                      <>
                        {" "}
                        {selectedRows.length - bulkEligible.length} skipped (already there,
                        further along, or cancelled).
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setBulkStatusOpen(false)}
              disabled={bulkStatusLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={applyBulkStatus}
              disabled={!bulkStatusValue || bulkEligible.length === 0 || bulkStatusLoading}
            >
              {bulkStatusLoading && <Loader2 className="size-4 animate-spin" />}
              {bulkStatusValue && bulkEligible.length > 0
                ? `Update ${bulkEligible.length} order${bulkEligible.length === 1 ? "" : "s"}`
                : "Update orders"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SourceChip({ source }: { source: OrderSource }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2 text-xs font-medium">
      {source === "whatsapp" && <MessageCircle className="size-3" />}
      {ORDER_SOURCE_LABELS[source] ?? source}
    </span>
  );
}
