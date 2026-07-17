"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Trash2, Star, Pencil, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toaster";
import { formatNigerianPhone } from "@/lib/phone";
import { NIGERIAN_STATES } from "@/lib/mock-data";

export interface AddressView {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  isDefault: boolean;
}

type DialogMode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; address: AddressView };

export function AddressesClient({ initial }: { initial: AddressView[] }) {
  const router = useRouter();
  const [addresses, setAddresses] = React.useState(initial);
  const [dialog, setDialog] = React.useState<DialogMode>({ kind: "closed" });
  const [busyId, setBusyId] = React.useState<string | null>(null);

  function refresh(list: AddressView[]) {
    setAddresses(list);
    router.refresh();
  }

  async function handleSave(values: AddressFormValues, editingId?: string) {
    const url = editingId
      ? `/api/v1/customer/addresses/${editingId}`
      : "/api/v1/customer/addresses";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json?.error?.message ?? "Could not save address");
      return false;
    }
    const saved = json.data.address as AddressView;
    if (editingId) {
      const next = addresses.map((a) =>
        a.id === editingId
          ? saved
          // Clearing other defaults when this one became default.
          : saved.isDefault
            ? { ...a, isDefault: false }
            : a,
      );
      refresh(next);
      toast.success("Address updated");
    } else {
      const next = saved.isDefault
        ? [saved, ...addresses.map((a) => ({ ...a, isDefault: false }))]
        : [...addresses, saved];
      refresh(next);
      toast.success("Address added");
    }
    return true;
  }

  async function makeDefault(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v1/customer/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? "Could not update");
        return;
      }
      refresh(
        addresses.map((a) =>
          a.id === id ? { ...a, isDefault: true } : { ...a, isDefault: false },
        ),
      );
      toast.success("Default address updated");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this address? This can't be undone.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/v1/customer/addresses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? "Could not delete");
        return;
      }
      const remaining = addresses.filter((a) => a.id !== id);
      const removed = addresses.find((a) => a.id === id);
      // If we deleted the default, the API promoted the oldest remaining
      // address to default. Mirror that in local state.
      if (removed?.isDefault && remaining.length > 0) {
        const oldest = remaining[0]!;
        remaining[0] = { ...oldest, isDefault: true };
      }
      refresh(remaining);
      toast.success("Address removed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight">
            Addresses
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            {addresses.length === 0
              ? "Save delivery destinations for faster checkout."
              : `${addresses.length} saved · default used at checkout unless you change it`}
          </p>
        </div>
        <Button size="md" onClick={() => setDialog({ kind: "create" })}>
          <Plus className="size-4" /> Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-8" />}
          title="No saved addresses"
          description="Add an address now and we'll pre-fill it the next time you check out."
          action={
            <Button onClick={() => setDialog({ kind: "create" })}>
              <Plus className="size-4" /> Add your first address
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((a) => (
            <div
              key={a.id}
              className="p-5 rounded-lg border border-border bg-surface hover:border-border-strong transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="size-4 text-fg-muted flex-shrink-0" />
                  <span className="font-bold text-sm truncate">{a.label}</span>
                  {a.isDefault && <Badge tone="brand">Default</Badge>}
                </div>
              </div>
              <div className="text-sm space-y-0.5">
                <div className="font-semibold">{a.recipient}</div>
                <div className="text-fg-muted">{a.line1}</div>
                {a.line2 && <div className="text-fg-muted">{a.line2}</div>}
                <div className="text-fg-muted">
                  {a.city}, {a.state}
                </div>
                <div className="text-fg-muted font-mono text-xs tabular mt-1">
                  {formatNigerianPhone(a.phone)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDialog({ kind: "edit", address: a })}
                  disabled={busyId === a.id}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
                {!a.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => makeDefault(a.id)}
                    disabled={busyId === a.id}
                  >
                    {busyId === a.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Star className="size-3.5" />
                    )}
                    Make default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(a.id)}
                  disabled={busyId === a.id}
                  className="text-danger hover:text-danger ml-auto"
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog.kind !== "closed" && (
        <AddressDialog
          mode={dialog}
          onClose={() => setDialog({ kind: "closed" })}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

interface AddressFormValues {
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  isDefault?: boolean;
}

function AddressDialog({
  mode,
  onClose,
  onSave,
}: {
  mode: Exclude<DialogMode, { kind: "closed" }>;
  onClose: () => void;
  onSave: (values: AddressFormValues, editingId?: string) => Promise<boolean>;
}) {
  const isEdit = mode.kind === "edit";
  const initial = isEdit ? mode.address : null;
  const [label, setLabel] = React.useState(initial?.label ?? "Home");
  const [recipient, setRecipient] = React.useState(initial?.recipient ?? "");
  const [phone, setPhone] = React.useState(initial?.phone ?? "");
  const [line1, setLine1] = React.useState(initial?.line1 ?? "");
  const [line2, setLine2] = React.useState(initial?.line2 ?? "");
  const [city, setCity] = React.useState(initial?.city ?? "");
  const [state, setState] = React.useState(initial?.state ?? "Kaduna");
  const [makeDefault, setMakeDefault] = React.useState(initial?.isDefault ?? false);
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipient.trim() || !phone.trim() || !line1.trim() || !city.trim()) {
      toast.error("Fill in the required fields.");
      return;
    }
    setSaving(true);
    const ok = await onSave(
      {
        label: label.trim(),
        recipient: recipient.trim(),
        phone: phone.trim(),
        line1: line1.trim(),
        line2: line2.trim() || null,
        city: city.trim(),
        state,
        isDefault: makeDefault,
      },
      isEdit ? mode.address.id : undefined,
    );
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-fg/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-lg">
            {isEdit ? "Edit address" : "Add address"}
          </h2>
          <button
            onClick={onClose}
            className="size-8 inline-flex items-center justify-center rounded-md hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 flex flex-col gap-3">
          <Field id="label" label="Label">
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Home, Office, Mum's place…"
            />
          </Field>
          <Field id="recipient" label="Recipient name" required>
            <Input
              id="recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </Field>
          <Field id="phone" label="Phone" required>
            <PhoneInput
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field id="line1" label="Street address" required>
            <Textarea
              id="line1"
              rows={2}
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              placeholder="House number, street, area"
            />
          </Field>
          <Field id="line2" label="Apartment / building (optional)">
            <Input
              id="line2"
              value={line2 ?? ""}
              onChange={(e) => setLine2(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="city" label="LGA / city" required>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Sabon Gari"
              />
            </Field>
            <Field id="state" label="State" required>
              <Select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {!initial?.isDefault && (
            <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(e) => setMakeDefault(e.target.checked)}
                className="size-4 accent-brand-primary"
              />
              Use as my default delivery address
            </label>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving…" : isEdit ? "Save changes" : "Save address"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
