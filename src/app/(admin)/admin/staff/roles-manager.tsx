"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { PERMISSION_CATALOG } from "@/lib/permissions";

export interface RoleView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export function RolesManager({
  roles,
  canManage,
}: {
  roles: RoleView[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<RoleView | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [perms, setPerms] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const open = creating || editing !== null;

  function startCreate() {
    setName("");
    setDescription("");
    setPerms(new Set());
    setEditing(null);
    setCreating(true);
  }
  function startEdit(r: RoleView) {
    setName(r.name);
    setDescription(r.description ?? "");
    setPerms(new Set(r.permissions));
    setCreating(false);
    setEditing(r);
  }
  function close() {
    if (!saving) {
      setCreating(false);
      setEditing(null);
    }
  }
  function togglePerm(key: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleGroup(keys: string[], on: boolean) {
    setPerms((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Role name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/v1/admin/roles/${editing.id}` : "/api/v1/admin/roles",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            permissions: Array.from(perms),
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not save role");
        return;
      }
      toast.success(editing ? "Role updated" : "Role created");
      close();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: RoleView) {
    if (!confirm(`Delete the "${r.name}" role?`)) return;
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/v1/admin/roles/${r.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? "Could not delete role");
        return;
      }
      toast.success(`${r.name} deleted`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4 text-fg-muted" />
          <div>
            <div className="text-sm font-bold">Roles &amp; permissions</div>
            <div className="text-xs text-fg-muted mt-0.5">
              What each role can do. System roles can be edited but not deleted.
            </div>
          </div>
        </div>
        {canManage && (
          <Button size="sm" onClick={startCreate}>
            <Plus className="size-3.5" /> Create role
          </Button>
        )}
      </div>

      <div className="divide-y divide-border">
        {roles.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{r.name}</span>
                {r.isSystem && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-2 text-fg-muted">
                    <Lock className="size-2.5" /> System
                  </span>
                )}
              </div>
              <div className="text-[11px] text-fg-muted">
                {r.permissions.length} permission{r.permissions.length === 1 ? "" : "s"} ·{" "}
                {r.userCount} staff
                {r.description ? ` · ${r.description}` : ""}
              </div>
            </div>
            {canManage && (
              <>
                <button
                  onClick={() => startEdit(r)}
                  className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface-2"
                  aria-label={`Edit ${r.name}`}
                >
                  <Pencil className="size-3.5" />
                </button>
                {!r.isSystem && (
                  <button
                    onClick={() => remove(r)}
                    disabled={busyId === r.id}
                    className="p-1.5 text-fg-muted hover:text-danger rounded-md hover:bg-surface-2 disabled:opacity-50"
                    aria-label={`Delete ${r.name}`}
                  >
                    {busyId === r.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Role editor */}
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.name}` : "Create role"}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="role-name" label="Role name">
                <Input
                  id="role-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Warehouse lead"
                />
              </Field>
              <Field id="role-desc" label="Description (optional)">
                <Input
                  id="role-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Manages stock + fulfilment"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-3">
              {PERMISSION_CATALOG.map((group) => {
                const keys = group.perms.map((p) => p.key);
                const allOn = keys.every((k) => perms.has(k));
                return (
                  <div key={group.group} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-fg-muted">
                        {group.group}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroup(keys, !allOn)}
                        className="text-[11px] font-semibold text-brand-primary hover:underline"
                      >
                        {allOn ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {group.perms.map((p) => (
                        <label
                          key={p.key}
                          className="flex items-center gap-2 text-sm cursor-pointer py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={perms.has(p.key)}
                            onChange={() => togglePerm(p.key)}
                            className="size-4 accent-[hsl(var(--brand-primary))]"
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <span className="mr-auto text-xs text-fg-muted self-center">
              {perms.size} permission{perms.size === 1 ? "" : "s"} selected
            </span>
            <Button variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
