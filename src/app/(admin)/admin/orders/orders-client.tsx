"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { OrderStatusPill, PaymentStatusPill } from "@/components/ui/status-pill";
import { DataTable } from "@/components/ui/data-table";
import { SavedViewBar, type SavedView } from "@/components/ui/saved-view-bar";
import { FilterBar, type FilterConfig } from "@/components/ui/filter-bar";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
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
import { type OrderListRow, type OrderSource } from "@/lib/admin-mock-data";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];
const PAYMENT_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
];
const SOURCE_OPTIONS = [
  { value: "web", label: "Web" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Phone" },
  { value: "walkin", label: "Walk-in" },
  { value: "ai", label: "AI agent" },
];

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

interface Props {
  orders: OrderListRow[];
  totals: { weekCount: number; weekRevenueLabel: string };
}

export function OrdersListClient({ orders, totals }: Props) {
  const router = useRouter();
  const [view, setView] = React.useState<string>("today");
  const [search, setSearch] = React.useState("");
  const [statusValues, setStatusValues] = React.useState<string[]>([]);
  const [paymentValues, setPaymentValues] = React.useState<string[]>([]);
  const [sourceValues, setSourceValues] = React.useState<string[]>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  const [cancelTarget, setCancelTarget] = React.useState<OrderListRow | null>(null);
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [statusLoading, setStatusLoading] = React.useState<string | null>(null);
  const [bulkStatusOpen, setBulkStatusOpen] = React.useState(false);
  const [bulkStatusValue, setBulkStatusValue] = React.useState<string>("");
  const [bulkStatusLoading, setBulkStatusLoading] = React.useState(false);

  const filters: FilterConfig[] = [
    { id: "status", label: "Status", values: statusValues, options: STATUS_OPTIONS, multi: true },
    { id: "payment", label: "Payment", values: paymentValues, options: PAYMENT_OPTIONS, multi: true },
    { id: "source", label: "Source", values: sourceValues, options: SOURCE_OPTIONS, multi: true },
  ];

  // Saved-view counts — computed from the actual orders we received. We only
  // include views that can be derived without a separate query.
  const savedViews: SavedView[] = React.useMemo(
    () => [
      { id: "today", label: "All", count: orders.length },
      {
        id: "awaiting",
        label: "Awaiting confirm",
        count: orders.filter((o) => o.status === "pending").length,
      },
      {
        id: "partial",
        label: "Partially paid",
        count: orders.filter((o) => o.payment === "partial").length,
      },
      {
        id: "outstanding",
        label: "Outstanding balance",
        count: orders.filter((o) => o.outstandingKobo > 0).length,
      },
      {
        id: "whatsapp",
        label: "WhatsApp source",
        count: orders.filter((o) => o.source === "whatsapp").length,
      },
    ],
    [orders],
  );

  const filtered = React.useMemo(() => {
    return orders.filter((o) => {
      if (
        search &&
        ![o.number, o.customerName, o.customerPhone]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      ) {
        return false;
      }
      if (statusValues.length > 0 && !statusValues.includes(o.status)) return false;
      if (paymentValues.length > 0 && !paymentValues.includes(o.payment)) return false;
      if (sourceValues.length > 0 && !sourceValues.includes(o.source)) return false;
      return true;
    });
  }, [orders, search, statusValues, paymentValues, sourceValues]);

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
      cell: ({ row }) => <OrderStatusPill status={row.original.status} />,
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
            subtitle={`${totals.weekCount} orders this week · ${totals.weekRevenueLabel}`}
            actions={
              <>
                <a href="/api/v1/admin/orders/export" download>
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
            onChange={setView}
            className="mb-4"
          />

          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Order #, customer, phone…"
            filters={filters}
            onFilterChange={(id, values) => {
              if (id === "status") setStatusValues(values);
              if (id === "payment") setPaymentValues(values);
              if (id === "source") setSourceValues(values);
            }}
            onClear={() => {
              setStatusValues([]);
              setPaymentValues([]);
              setSourceValues([]);
            }}
            className="mb-4"
          />

          <DataTable
            columns={columns}
            data={filtered}
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
  const labels: Record<OrderSource, string> = {
    web: "Web",
    whatsapp: "WhatsApp",
    phone: "Phone",
    walkin: "Walk-in",
    ai: "AI agent",
  };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2 text-xs font-medium">
      {source === "whatsapp" && <MessageCircle className="size-3" />}
      {labels[source]}
    </span>
  );
}
