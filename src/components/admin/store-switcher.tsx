"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Store, ChevronDown, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";

interface StoreOpt {
  slug: string;
  name: string;
  isMain: boolean;
}

/** Active-store picker for full-coverage admins. Renders nothing for staff who
 *  can't switch (or when there's only one store). Selecting a store re-scopes
 *  the entire admin on refresh. */
export function StoreSwitcher() {
  const router = useRouter();
  const [stores, setStores] = React.useState<StoreOpt[]>([]);
  const [activeSlug, setActiveSlug] = React.useState<string | null>(null);
  const [canSwitch, setCanSwitch] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/v1/admin/active-store")
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.data) return;
        setCanSwitch(!!j.data.canSwitch);
        setStores(j.data.stores ?? []);
        setActiveSlug(j.data.activeSlug ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function pick(slug: string) {
    if (slug === activeSlug) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/admin/active-store", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(j?.error?.message ?? "Couldn't switch store");
        return;
      }
      setActiveSlug(slug);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (!canSwitch || stores.length <= 1) return null;

  const active = stores.find((s) => s.slug === activeSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-md border border-border-strong bg-surface hover:bg-surface-2 text-sm font-semibold max-w-[180px]"
          disabled={busy}
          aria-label="Switch store"
        >
          <Store className="size-4 text-fg-muted flex-shrink-0" />
          <span className="truncate">{active?.name ?? "Select store"}</span>
          {busy ? (
            <Loader2 className="size-3.5 animate-spin flex-shrink-0" />
          ) : (
            <ChevronDown className="size-3.5 text-fg-muted flex-shrink-0" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuLabel>Viewing store</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {stores.map((s) => (
          <DropdownMenuItem
            key={s.slug}
            onClick={() => pick(s.slug)}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate">
              {s.name}
              {s.isMain && <span className="text-fg-muted"> · main</span>}
            </span>
            {s.slug === activeSlug && <Check className="size-3.5 text-brand-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
