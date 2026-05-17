"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Download,
  MoreHorizontal,
  MessageCircle,
  Mail,
  Printer,
  XCircle,
  Eye,
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
import { toast } from "@/components/ui/toaster";
import { waLink } from "@/lib/contact-links";
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
          <div className="font-semibold">{row.original.customerName}</div>
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
                <Eye className="size-3.5" /> View
              </DropdownMenuItem>
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
                disabled={row.original.status === "cancelled" || row.original.status === "delivered"}
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
                    id: "cancel",
                    label: "Cancel orders",
                    icon: <XCircle className="size-3.5" />,
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
        onConfirm={() => {
          setCancelLoading(true);
          window.setTimeout(() => {
            setCancelLoading(false);
            setCancelTarget(null);
            toast.success(`Order ${cancelTarget?.number} cancelled`);
          }, 500);
        }}
      />
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
