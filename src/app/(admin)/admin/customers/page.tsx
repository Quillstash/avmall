"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Download,
  MoreHorizontal,
  Mail,
  MessageCircle,
  ShieldAlert,
  Tag,
  ShieldOff,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, initialsOf } from "@/components/ui/avatar";
import { DataTable } from "@/components/ui/data-table";
import { SavedViewBar, type SavedView } from "@/components/ui/saved-view-bar";
import { FilterBar, type FilterConfig } from "@/components/ui/filter-bar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toaster";
import { CUSTOMERS, type CustomerListRow } from "@/lib/admin-mock-data";

export default function AdminCustomersListPage() {
  const router = useRouter();
  const [view, setView] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [segmentValues, setSegmentValues] = React.useState<string[]>([]);
  const [blacklistTarget, setBlacklistTarget] = React.useState<CustomerListRow | null>(null);

  const blacklistedCount = CUSTOMERS.filter((c) => c.blacklisted).length;

  const savedViews: SavedView[] = [
    { id: "all", label: "All", count: 1240 },
    { id: "vip", label: "VIP", count: 42 },
    { id: "wholesale", label: "Wholesale", count: 87 },
    { id: "lagos", label: "Lagos", count: 412 },
    { id: "inactive", label: "Inactive 90d+", count: 156 },
    { id: "blacklist", label: "Blacklisted", count: blacklistedCount },
  ];

  const filters: FilterConfig[] = [
    {
      id: "segment",
      label: "Segment",
      values: segmentValues,
      options: [
        { value: "VIP", label: "VIP" },
        { value: "Wholesale", label: "Wholesale" },
        { value: "Lagos", label: "Lagos" },
        { value: "Anambra", label: "Anambra" },
        { value: "Kano", label: "Kano" },
        { value: "FCT", label: "FCT" },
      ],
      multi: true,
    },
  ];

  const filtered = React.useMemo(() => {
    return CUSTOMERS.filter((c) => {
      if (view === "blacklist" && !c.blacklisted) return false;
      if (view === "vip" && !c.segments.includes("VIP")) return false;
      if (view === "wholesale" && !c.segments.includes("Wholesale")) return false;
      if (view === "lagos" && !c.segments.includes("Lagos")) return false;
      if (
        search &&
        ![c.name, c.phone, c.email ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      if (
        segmentValues.length > 0 &&
        !segmentValues.some((v) => c.segments.includes(v))
      )
        return false;
      return true;
    });
  }, [view, search, segmentValues]);

  const columns: ColumnDef<CustomerListRow>[] = [
    {
      accessorKey: "name",
      header: "Customer",
      cell: ({ row }) => (
        <Link
          href={`/admin/customers/${row.original.id}`}
          className="flex items-center gap-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar size="sm">
            <AvatarFallback>{initialsOf(row.original.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-semibold inline-flex items-center gap-1.5">
              {row.original.name}
              {row.original.blacklisted && (
                <ShieldAlert
                  className="size-3.5 text-danger"
                  aria-label="Blacklisted"
                />
              )}
            </div>
            <div className="text-[11px] text-fg-muted font-mono tabular">
              {row.original.phone}
            </div>
          </div>
        </Link>
      ),
    },
    {
      accessorKey: "segments",
      header: "Segments",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap">
          {row.original.segments.map((s) => (
            <Badge key={s} tone={s === "VIP" ? "brand" : "neutral"}>
              {s}
            </Badge>
          ))}
          {row.original.blacklisted && <Badge tone="danger">Blacklisted</Badge>}
        </div>
      ),
    },
    {
      accessorKey: "orders",
      header: () => <div className="text-right">Orders</div>,
      cell: ({ row }) => (
        <div className="text-right tabular font-semibold">{row.original.orders}</div>
      ),
    },
    {
      accessorKey: "lifetimeKobo",
      header: () => <div className="text-right">Lifetime spend</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Money kobo={row.original.lifetimeKobo} className="font-bold" />
        </div>
      ),
    },
    {
      accessorKey: "lastOrder",
      header: "Last order",
      cell: ({ row }) => (
        <div className="text-xs text-fg-muted">{row.original.lastOrder}</div>
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
                onClick={() => router.push(`/admin/customers/${row.original.id}`)}
              >
                View profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("WhatsApp opened")}>
                <MessageCircle className="size-3.5" /> WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Email composer opened")}>
                <Mail className="size-3.5" /> Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Tag added")}>
                <Tag className="size-3.5" /> Tag…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {row.original.blacklisted ? (
                <DropdownMenuItem onClick={() => toast.success("Customer unblocked")}>
                  Unblock
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  destructive
                  onClick={() => setBlacklistTarget(row.original)}
                >
                  <ShieldOff className="size-3.5" /> Blacklist customer
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Customers" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Customers"
            subtitle={`1,240 customers · ${blacklistedCount} blacklisted`}
            actions={
              <>
                <Button variant="secondary" size="sm">
                  <Download className="size-3.5" /> Export
                </Button>
                <Button size="sm">
                  <Plus className="size-3.5" /> Add customer
                </Button>
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
            searchPlaceholder="Name, phone, email…"
            filters={filters}
            onFilterChange={(id, values) => {
              if (id === "segment") setSegmentValues(values);
            }}
            onClear={() => setSegmentValues([])}
            className="mb-4"
          />

          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(row) => router.push(`/admin/customers/${row.id}`)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={!!blacklistTarget}
        onOpenChange={(o) => !o && setBlacklistTarget(null)}
        title="Blacklist this customer?"
        description={
          blacklistTarget && (
            <>
              <span className="font-semibold">{blacklistTarget.name}</span> will be blocked from
              placing new orders. Existing orders are locked from further action.
            </>
          )
        }
        confirmLabel="Blacklist"
        destructive
        typeToConfirm="BLACKLIST"
        onConfirm={() => {
          toast.success(`${blacklistTarget?.name} blacklisted`);
          setBlacklistTarget(null);
        }}
      />
    </>
  );
}
