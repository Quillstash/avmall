"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Power, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

/**
 * Per-row actions on the discounts list. Toggle-active is the only safe
 * mutation once a discount has been redeemed (everything else is locked,
 * see CLAUDE.md §20). Delete is hidden once usage > 0 — staff must
 * deactivate instead.
 */
export function DiscountRowActions({
  id,
  active,
  usage,
  name,
}: {
  id: string;
  active: boolean;
  usage: number;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function toggleActive() {
    setOpen(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/discounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not update discount");
        return;
      }
      toast.success(`${name} ${!active ? "activated" : "deactivated"}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setOpen(false);
    if (!confirm(`Delete discount "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/discounts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? "Could not delete discount");
        return;
      }
      toast.success(`${name} deleted`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface disabled:opacity-50"
        aria-label="Row actions"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 min-w-44 rounded-md border border-border bg-surface shadow-lg py-1">
          <button
            onClick={() => {
              setOpen(false);
              router.push(`/admin/discounts/${id}/edit`);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2 inline-flex items-center gap-2"
          >
            <Pencil className="size-4" />
            Edit
          </button>
          <button
            onClick={toggleActive}
            className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2 inline-flex items-center gap-2"
          >
            <Power className="size-4" />
            {active ? "Deactivate" : "Activate"}
          </button>
          {usage === 0 && (
            <button
              onClick={remove}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-danger-bg text-danger inline-flex items-center gap-2",
              )}
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
