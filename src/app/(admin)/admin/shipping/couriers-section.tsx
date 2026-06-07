"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Star, Power, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import type { CourierView } from "@/lib/data/shipping";

interface FormState {
  name: string;
  phone: string;
  trackingUrl: string;
  note: string;
}
const BLANK: FormState = { name: "", phone: "", trackingUrl: "", note: "" };

export function CouriersSection({ couriers }: { couriers: CourierView[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<CourierView | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(BLANK);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const open = creating || editing !== null;

  function startCreate() {
    setForm(BLANK);
    setEditing(null);
    setCreating(true);
  }
  function startEdit(c: CourierView) {
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      trackingUrl: c.trackingUrl ?? "",
      note: c.note ?? "",
    });
    setCreating(false);
    setEditing(c);
  }
  function close() {
    if (!saving) {
      setCreating(false);
      setEditing(null);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Courier name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/v1/admin/couriers/${editing.id}` : "/api/v1/admin/couriers",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim(),
            trackingUrl: form.trackingUrl.trim(),
            note: form.note.trim(),
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not save courier");
        return;
      }
      toast.success(editing ? "Courier updated" : "Courier added");
      close();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>, okMsg: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v1/admin/couriers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not update courier");
        return;
      }
      toast.success(okMsg);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: CourierView) {
    if (!confirm(`Remove courier "${c.name}"?`)) return;
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/v1/admin/couriers/${c.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? "Could not remove courier");
        return;
      }
      toast.success(`${c.name} removed`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="text-sm font-bold">Couriers</div>
        <Button size="sm" variant="secondary" onClick={startCreate}>
          <Plus className="size-3.5" /> Add courier
        </Button>
      </div>
      <div className="p-2">
        {couriers.length === 0 ? (
          <div className="text-center text-sm text-fg-muted py-6">
            No couriers yet. Add the delivery services you use.
          </div>
        ) : (
          <ul className="flex flex-col">
            {couriers.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 px-2 py-2.5 rounded-md hover:bg-surface-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  {(c.phone || c.trackingUrl) && (
                    <div className="text-[11px] text-fg-muted truncate">
                      {[c.phone, c.trackingUrl].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                {c.isPrimary ? (
                  <Badge tone="success">Primary</Badge>
                ) : c.active ? (
                  <Badge>Active</Badge>
                ) : (
                  <Badge tone="neutral">Inactive</Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface disabled:opacity-50"
                      aria-label={`Actions for ${c.name}`}
                      disabled={busyId === c.id}
                    >
                      {busyId === c.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="size-4" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!c.isPrimary && (
                      <DropdownMenuItem
                        onClick={() => patch(c.id, { isPrimary: true, active: true }, `${c.name} set as primary`)}
                      >
                        <Star className="size-3.5" /> Set as primary
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => startEdit(c)}>
                      <Pencil className="size-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        patch(c.id, { active: !c.active }, `${c.name} ${c.active ? "deactivated" : "activated"}`)
                      }
                    >
                      <Power className="size-3.5" /> {c.active ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onClick={() => remove(c)}>
                      <Trash2 className="size-3.5" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add courier"}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-3">
            <Field id="c-name" label="Courier name">
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="GIG Logistics"
              />
            </Field>
            <Field id="c-phone" label="Phone (optional)">
              <Input
                id="c-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+234 …"
              />
            </Field>
            <Field id="c-track" label="Tracking URL (optional)" hint="Use {tracking} where the tracking number goes">
              <Input
                id="c-track"
                value={form.trackingUrl}
                onChange={(e) => setForm((f) => ({ ...f, trackingUrl: e.target.value }))}
                placeholder="https://giglogistics.com/track?id={tracking}"
              />
            </Field>
            <Field id="c-note" label="Note (optional)">
              <Input
                id="c-note"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Covers intra-Lagos, same-day"
              />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add courier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
