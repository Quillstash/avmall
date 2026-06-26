"use client";

import * as React from "react";
import { MapPin, ChevronDown, Check, Loader2 } from "lucide-react";
import { STORE_COOKIE, storefrontPathForStore } from "@/lib/store-constants";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export interface StoreOption {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  isMain: boolean;
}

/**
 * Navigate to a store's storefront. Persists the choice in the store cookie
 * first, then does a FULL navigation (main = "/", sub-store = "/s/<slug>").
 *
 * The cookie write is what makes switching back to Main work: the middleware
 * only sets the cookie on /s/<slug> requests, so a bare "/" load would
 * otherwise keep reading the previous sub-store's slug. A full navigation (not
 * a soft route change) also avoids reconciling one store's nav against another
 * — the source of an earlier hydration mismatch.
 */
export function gotoStore(store: { slug: string; isMain: boolean }) {
  document.cookie = `${STORE_COOKIE}=${encodeURIComponent(store.slug)}; path=/; max-age=31536000; samesite=lax`;
  window.location.assign(storefrontPathForStore(store));
}

/**
 * Storefront store picker. Writes the selected store's slug to a cookie and
 * refreshes so server components re-render with that store's stock.
 */
export function StoreSwitcher({
  stores,
  currentSlug,
  className,
}: {
  stores: StoreOption[];
  currentSlug: string | null;
  className?: string;
}) {
  const [pending, setPending] = React.useState(false);

  if (stores.length === 0) return null;
  const current = stores.find((s) => s.slug === currentSlug) ?? stores[0]!;

  // Single store — nothing to switch; show a static label.
  if (stores.length === 1) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
        <MapPin className="size-3" />
        {current.name}
      </span>
    );
  }

  function select(slug: string) {
    if (slug === current.slug) return;
    const store = stores.find((s) => s.slug === slug);
    if (!store) return;
    setPending(true);
    gotoStore(store);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 hover:text-fg transition-colors ${className ?? ""}`}
          aria-label="Choose store"
        >
          {pending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <MapPin className="size-3" />
          )}
          <span className="font-medium">{current.name}</span>
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {stores.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => select(s.slug)}
            className="gap-2"
          >
            <span className="flex-1">
              <span className="font-medium">{s.name}</span>
              {(s.city || s.state) && (
                <span className="block text-[11px] text-fg-muted">
                  {[s.city, s.state].filter(Boolean).join(", ")}
                </span>
              )}
            </span>
            {s.slug === current.slug && <Check className="size-3.5 text-brand-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
