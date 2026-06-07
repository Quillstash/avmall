"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Store as StoreIcon,
  Plus,
  Pencil,
  Star,
  Loader2,
  Package,
  Users,
  Receipt,
} from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions";
import { NIGERIAN_STATES } from "@/lib/mock-data";
import type { StoreRow } from "@/lib/data/stores";
import { cn } from "@/lib/utils";

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  isMain: boolean;
  active: boolean;
}

const BLANK: FormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "Lagos",
  isMain: false,
  active: true,
};

export function StoresClient({ stores }: { stores: StoreRow[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canCreate = role ? hasPermission({ role }, "stores.create") : false;
  const canEdit = role ? hasPermission({ role }, "stores.edit") : false;

  const [editing, setEditing] = React.useState<StoreRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(BLANK);
  const [saving, setSaving] = React.useState(false);

  const open = creating || editing !== null;

  function startCreate() {
    setForm(BLANK);
    setEditing(null);
    setCreating(true);
  }
  function startEdit(s: StoreRow) {
    setForm({
      name: s.name,
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      city: s.city ?? "",
      state: s.state ?? "Lagos",
      isMain: s.isMain,
      active: s.active,
    });
    setCreating(false);
    setEditing(s);
  }
  function close() {
    if (saving) return;
    setCreating(false);
    setEditing(null);
  }
  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Store name is required.");
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `/api/v1/admin/stores/${editing.id}`
        : "/api/v1/admin/stores";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          isMain: form.isMain,
          active: form.active,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not save store");
        return;
      }
      toast.success(editing ? "Store updated" : "Store created");
      close();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Stores" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1200px] mx-auto">
          <PageHeader
            title="Stores"
            subtitle={`${stores.length} ${stores.length === 1 ? "store" : "stores"} · inventory and orders are tracked per store`}
            actions={
              canCreate ? (
                <Button size="sm" onClick={startCreate}>
                  <Plus className="size-3.5" /> New store
                </Button>
              ) : undefined
            }
          />

          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            {stores.length === 0 ? (
              <div className="flex flex-col items-center text-center py-16 px-6">
                <StoreIcon className="size-8 text-fg-subtle mb-3" />
                <p className="text-sm font-semibold">No stores yet</p>
                <p className="text-xs text-fg-muted mt-1">
                  Create your first store to start tracking inventory per location.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <th className="text-left px-4 py-2.5">Store</th>
                    <th className="text-left px-4 py-2.5">Location</th>
                    <th className="text-right px-4 py-2.5">Products</th>
                    <th className="text-right px-4 py-2.5">Staff</th>
                    <th className="text-right px-4 py-2.5">Orders</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {stores.map((s) => (
                    <tr key={s.id} className="border-t border-border hover:bg-surface-2/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{s.name}</span>
                          {s.isMain && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary">
                              <Star className="size-2.5" /> Main
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-fg-muted font-mono">/{s.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-fg-muted">
                        {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular">
                        <span className="inline-flex items-center gap-1 text-fg-muted">
                          <Package className="size-3" /> {s.stockedVariants}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular">
                        <span className="inline-flex items-center gap-1 text-fg-muted">
                          <Users className="size-3" /> {s.staffCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular">
                        <span className="inline-flex items-center gap-1 text-fg-muted">
                          <Receipt className="size-3" /> {s.orderCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
                            s.active
                              ? "bg-success-bg text-brand-accent"
                              : "bg-surface-2 text-fg-muted",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              s.active ? "bg-brand-accent" : "bg-fg-subtle",
                            )}
                          />
                          {s.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (
                          <button
                            onClick={() => startEdit(s)}
                            className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface"
                            aria-label={`Edit ${s.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "New store"}</DialogTitle>
          </DialogHeader>

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="store-name" label="Store name" className="sm:col-span-2">
              <Input
                id="store-name"
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Ikoyi flagship"
              />
            </Field>
            <Field id="store-phone" label="Phone (optional)">
              <Input
                id="store-phone"
                value={form.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                placeholder="+234 803 …"
              />
            </Field>
            <Field id="store-email" label="Email (optional)">
              <Input
                id="store-email"
                value={form.email}
                onChange={(e) => patch({ email: e.target.value })}
                placeholder="ikoyi@avmall.ng"
              />
            </Field>
            <Field id="store-address" label="Street address (optional)" className="sm:col-span-2">
              <Input
                id="store-address"
                value={form.address}
                onChange={(e) => patch({ address: e.target.value })}
                placeholder="14 Bourdillon Road"
              />
            </Field>
            <Field id="store-city" label="City / LGA (optional)">
              <Input
                id="store-city"
                value={form.city}
                onChange={(e) => patch({ city: e.target.value })}
                placeholder="Ikoyi"
              />
            </Field>
            <Field id="store-state" label="State">
              <Select
                id="store-state"
                value={form.state}
                onChange={(e) => patch({ state: e.target.value })}
              >
                {NIGERIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </Select>
            </Field>

            <label className="sm:col-span-2 flex items-center gap-2.5 mt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isMain}
                onChange={(e) => patch({ isMain: e.target.checked })}
                className="size-4 accent-[hsl(var(--brand-primary))]"
              />
              <span className="text-sm">
                <span className="font-semibold">Main store</span>{" "}
                <span className="text-fg-muted">— the storefront lands here by default</span>
              </span>
            </label>
            <label className="sm:col-span-2 flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => patch({ active: e.target.checked })}
                className="size-4 accent-[hsl(var(--brand-primary))]"
              />
              <span className="text-sm">
                <span className="font-semibold">Active</span>{" "}
                <span className="text-fg-muted">— customers can shop and staff can sell here</span>
              </span>
            </label>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create store"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
