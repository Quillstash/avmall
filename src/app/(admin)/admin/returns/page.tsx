"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, MoreHorizontal, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { SavedViewBar, type SavedView } from "@/components/ui/saved-view-bar";
import { FilterBar, type FilterConfig } from "@/components/ui/filter-bar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { RETURNS, type ReturnListRow, type ReturnStatus } from "@/lib/admin-mock-data";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  in_transit: "In transit",
  received: "Received",
  refunded: "Refunded",
  rejected: "Rejected",
};

const STATUS_CLASSES: Record<ReturnStatus, string> = {
  requested: "bg-warning-bg text-warning",
  approved: "bg-info-bg text-info",
  in_transit: "bg-status-shipped/15 text-status-shipped",
  received: "bg-status-processing/15 text-status-processing",
  refunded: "bg-success-bg text-success",
  rejected: "bg-surface-2 text-fg-muted",
};

export default function AdminReturnsListPage() {
  const router = useRouter();
  const [view, setView] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [statusValues, setStatusValues] = React.useState<string[]>([]);

  const slaCount = RETURNS.filter((r) => r.slaBreached).length;
  const pendingCount = RETURNS.filter(
    (r) => r.status === "requested" || r.status === "approved",
  ).length;
  const outsideCount = RETURNS.filter((r) => r.outsideWindow).length;

  const savedViews: SavedView[] = [
    { id: "all", label: "All", count: RETURNS.length },
    { id: "pending", label: "Pending", count: pendingCount },
    { id: "sla", label: "Over SLA", count: slaCount },
    { id: "outside", label: "Outside window", count: outsideCount },
    {
      id: "refunded",
      label: "Refunded",
      count: RETURNS.filter((r) => r.status === "refunded").length,
    },
  ];

  const filters: FilterConfig[] = [
    {
      id: "status",
      label: "Status",
      values: statusValues,
      multi: true,
      options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
    },
  ];

  const filtered = React.useMemo(() => {
    return RETURNS.filter((r) => {
      if (view === "pending" && r.status !== "requested" && r.status !== "approved")
        return false;
      if (view === "sla" && !r.slaBreached) return false;
      if (view === "outside" && !r.outsideWindow) return false;
      if (view === "refunded" && r.status !== "refunded") return false;
      if (
        search &&
        ![r.id, r.orderNumber, r.customerName, r.reason]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      if (statusValues.length > 0 && !statusValues.includes(r.status)) return false;
      return true;
    });
  }, [view, search, statusValues]);

  const columns: ColumnDef<ReturnListRow>[] = [
    {
      accessorKey: "id",
      header: "Return",
      cell: ({ row }) => (
        <Link
          href={`/admin/returns/${row.original.id}`}
          className="font-mono text-xs font-bold tabular hover:text-brand-primary"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.id}
        </Link>
      ),
    },
    {
      accessorKey: "orderNumber",
      header: "Order",
      cell: ({ row }) => (
        <Link
          href={`/admin/orders/${row.original.orderNumber}`}
          className="font-mono text-xs tabular hover:text-brand-primary"
          onClick={(e) => e.stopPropagation()}
        >
          #{row.original.orderNumber}
        </Link>
      ),
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => <div className="font-semibold">{row.original.customerName}</div>,
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => <div className="text-fg-muted text-xs">{row.original.reason}</div>,
    },
    {
      accessorKey: "refundKobo",
      header: () => <div className="text-right">Refund</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Money kobo={row.original.refundKobo} className="font-bold" />
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              STATUS_CLASSES[row.original.status],
            )}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {STATUS_LABELS[row.original.status]}
          </span>
          <div className="flex gap-1 mt-1 flex-wrap">
            {row.original.slaBreached && (
              <Badge tone="danger" className="inline-flex items-center gap-1">
                <Clock className="size-2.5" /> SLA
              </Badge>
            )}
            {row.original.outsideWindow && (
              <Badge tone="warning" className="inline-flex items-center gap-1">
                <AlertTriangle className="size-2.5" /> outside window
              </Badge>
            )}
            {row.original.fullyReturned && <Badge tone="neutral">fully returned</Badge>}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => <div className="text-xs text-fg-muted">{row.original.createdAt}</div>,
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
                onClick={() => router.push(`/admin/returns/${row.original.id}`)}
              >
                Open return
              </DropdownMenuItem>
              {row.original.status === "requested" && (
                <>
                  <DropdownMenuItem
                    onClick={async () => {
                      const res = await fetch(
                        `/api/v1/admin/returns/${row.original.id}/approve`,
                        { method: "POST" },
                      );
                      if (res.status === 404 || res.status === 503) {
                        toast.success("Return approved (local)");
                      } else if (res.ok) {
                        toast.success("Return approved");
                        router.refresh();
                      } else {
                        const p = await res.json();
                        toast.error(p.error?.message ?? "Failed");
                      }
                    }}
                  >
                    <CheckCircle2 className="size-3.5" /> Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    destructive
                    onClick={async () => {
                      const res = await fetch(
                        `/api/v1/admin/returns/${row.original.id}/approve`,
                        { method: "DELETE" },
                      );
                      if (res.status === 404 || res.status === 503) {
                        toast.success("Return rejected (local)");
                      } else if (res.ok) {
                        toast.success("Return rejected");
                        router.refresh();
                      } else {
                        const p = await res.json();
                        toast.error(p.error?.message ?? "Failed");
                      }
                    }}
                  >
                    Reject
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Returns" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Returns"
            subtitle={`${RETURNS.length} returns · ${pendingCount} pending · ${slaCount} over SLA`}
            actions={
              <Button variant="secondary" size="sm">
                <Download className="size-3.5" /> Export
              </Button>
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
            searchPlaceholder="Return ID, order, customer…"
            filters={filters}
            onFilterChange={(id, values) => id === "status" && setStatusValues(values)}
            onClear={() => setStatusValues([])}
            className="mb-4"
          />

          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(row) => router.push(`/admin/returns/${row.id}`)}
          />
        </div>
      </div>
    </>
  );
}
