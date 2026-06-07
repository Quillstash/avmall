"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown, Check, Loader2 } from "lucide-react";
import { STORE_COOKIE } from "@/lib/store-constants";
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
  const router = useRouter();
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
    document.cookie = `${STORE_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`;
    setPending(true);
    router.refresh();
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
