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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { waLink, mailtoLink } from "@/lib/contact-links";
import { type CustomerListRow } from "@/lib/admin-mock-data";

interface CustomersClientProps {
  customers: CustomerListRow[];
}

export function CustomersClient({ customers }: CustomersClientProps) {
  const router = useRouter();
  const [view, setView] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [segmentValues, setSegmentValues] = React.useState<string[]>([]);
  const [blacklistTarget, setBlacklistTarget] = React.useState<CustomerListRow | null>(null);
  const [tagTarget, setTagTarget] = React.useState<CustomerListRow | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const blacklistedCount = customers.filter((c) => c.blacklisted).length;
  // The quick-filter tabs follow the real tags present on customers (no
  // hardcoded placeholders), plus All and Blacklisted.
  const tags = React.useMemo(
    () =>
      [...new Set(customers.flatMap((c) => c.segments))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [customers],
  );

  const savedViews: SavedView[] = [
    { id: "all", label: "All", count: customers.length },
    ...tags.map((t) => ({
      id: t,
      label: t,
      count: customers.filter((c) => c.segments.includes(t)).length,
    })),
    { id: "blacklist", label: "Blacklisted", count: blacklistedCount },
  ];

  const filters: FilterConfig[] =
    tags.length > 0
      ? [
          {
            id: "segment",
            label: "Tag",
            values: segmentValues,
            options: tags.map((t) => ({ value: t, label: t })),
            multi: true,
          },
        ]
      : [];

  const filtered = React.useMemo(() => {
    return customers.filter((c) => {
      if (view === "blacklist") {
        if (!c.blacklisted) return false;
      } else if (view !== "all" && !c.segments.includes(view)) {
        return false;
      }
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
  }, [customers, view, search, segmentValues]);

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
              <DropdownMenuItem
                onClick={() =>
                  window.open(
                    waLink(
                      row.original.phone,
                      `Hi ${row.original.name.split(" ")[0]}, this is Avmall.`,
                    ),
                    "_blank",
                  )
                }
              >
                <MessageCircle className="size-3.5" /> WhatsApp
              </DropdownMenuItem>
              {row.original.email && (
                <DropdownMenuItem
                  onClick={() =>
                    window.open(mailtoLink(row.original.email!), "_blank")
                  }
                >
                  <Mail className="size-3.5" /> Email
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setTagTarget(row.original)}>
                <Tag className="size-3.5" /> Manage tags
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {row.original.blacklisted ? (
                <DropdownMenuItem
                  onClick={async () => {
                    const res = await fetch(
                      `/api/v1/admin/customers/${row.original.id}/blacklist`,
                      { method: "DELETE" },
                    );
                    if (res.status === 404 || res.status === 503) {
                      toast.success("Unblocked (local)");
                    } else if (res.ok) {
                      toast.success("Customer unblocked");
                      router.refresh();
                    } else {
                      const p = await res.json();
                      toast.error(p.error?.message ?? "Failed");
                    }
                  }}
                >
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
            subtitle={`${customers.length} customer${customers.length === 1 ? "" : "s"} · ${blacklistedCount} blacklisted`}
            actions={
              <>
                <a href="/api/v1/admin/customers/export" download>
                  <Button variant="secondary" size="sm">
                    <Download className="size-3.5" /> Export CSV
                  </Button>
                </a>
                <Button size="sm" onClick={() => setAddOpen(true)}>
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
        onConfirm={async () => {
          if (!blacklistTarget) return;
          try {
            const res = await fetch(
              `/api/v1/admin/customers/${blacklistTarget.id}/blacklist`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ reason: "Flagged from admin list" }),
              },
            );
            if (res.status === 404 || res.status === 503) {
              toast.success(`${blacklistTarget.name} blacklisted (local)`);
            } else {
              const payload = await res.json();
              if (!res.ok) throw new Error(payload.error?.message ?? "Failed");
              toast.success(`${blacklistTarget.name} blacklisted`);
              router.refresh();
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          } finally {
            setBlacklistTarget(null);
          }
        }}
      />

      {tagTarget && (
        <TagDialog
          customer={tagTarget}
          onClose={() => setTagTarget(null)}
          onSaved={(segments) => {
            setTagTarget(null);
            router.refresh();
            toast.success(`Tags updated for ${tagTarget.name}`);
            // Optimistic local update
            segments; // used by refresh
          }}
        />
      )}

      <AddCustomerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(id) => router.push(`/admin/customers/${id}`)}
      />
    </>
  );
}

function AddCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setEmail("");
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          ...(email.trim() && { email: email.trim() }),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not add customer");
        return;
      }
      toast.success("Customer added");
      onOpenChange(false);
      onCreated(json.data.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>
            Phone is normalised to +234 and must be unique. Tags can be added afterwards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3 mt-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-fg-muted">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-fg-muted">Phone</span>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0803 000 0000"
              inputMode="tel"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-fg-muted">
              Email <span className="font-normal text-fg-subtle">(optional)</span>
            </span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Add customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PRESET_TAGS = ["VIP", "Wholesale", "Lagos", "Abuja", "Kano", "Anambra", "Rivers", "Ibadan", "Retail", "B2B"];

function TagDialog({
  customer,
  onClose,
  onSaved,
}: {
  customer: CustomerListRow;
  onClose: () => void;
  onSaved: (segments: string[]) => void;
}) {
  const [segments, setSegments] = React.useState<string[]>([...customer.segments]);
  const [custom, setCustom] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function toggle(tag: string) {
    setSegments((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function addCustom() {
    const t = custom.trim();
    if (!t || segments.includes(t)) { setCustom(""); return; }
    setSegments((prev) => [...prev, t]);
    setCustom("");
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/customers/${customer.id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments }),
      });
      const json = await res.json();
      if (res.status === 503) { toast.success("Tags updated (local)"); onSaved(segments); return; }
      if (!res.ok) { toast.error(json?.error?.message ?? "Could not save tags"); return; }
      onSaved(segments);
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tags — {customer.name}</DialogTitle>
          <DialogDescription>Add or remove segments to filter and report on this customer.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">Presets</div>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className={segments.includes(tag)
                    ? "px-3 py-1 rounded-full text-xs font-semibold bg-brand-primary text-brand-primary-fg"
                    : "px-3 py-1 rounded-full text-xs font-semibold bg-surface-2 text-fg hover:bg-bg border border-border"}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">Custom tag</div>
            <div className="flex gap-2">
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
                placeholder="e.g. B2B, North, Kano"
                className="flex-1"
              />
              <button
                type="button"
                onClick={addCustom}
                className="px-3 py-1.5 rounded-md bg-surface-2 border border-border text-xs font-semibold hover:bg-bg"
              >
                Add
              </button>
            </div>
          </div>
          {segments.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-2">Applied ({segments.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {segments.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-info-bg text-brand-primary border border-brand-primary/20">
                    {tag}
                    <button type="button" onClick={() => toggle(tag)} className="ml-0.5 hover:text-danger">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="mt-5">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-fg-muted hover:text-fg px-3">Cancel</button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-brand-primary text-brand-primary-fg text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save tags"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
