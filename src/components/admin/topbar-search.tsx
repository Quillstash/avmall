"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Loader2, X, ShoppingBag, Box, User, type LucideIcon } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import type { AdminSearchResults, AdminSearchHit } from "@/lib/data/admin-search";

const EMPTY: AdminSearchResults = {
  orders: [],
  products: [],
  customers: [],
  totalCount: 0,
};

export function AdminTopBarSearch() {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<AdminSearchResults>(EMPTY);
  const [loading, setLoading] = React.useState(false);
  const debounced = useDebouncedValue(query, 250);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Cmd/Ctrl + K to focus the input from anywhere in the admin
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Click-outside closes
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Fetch on debounced query change
  React.useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/v1/admin/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json: { data?: AdminSearchResults }) => {
        setResults(json.data ?? EMPTY);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setLoading(false);
      });
    return () => ctrl.abort();
  }, [debounced]);

  const showDropdown = open && debounced.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className="flex items-center gap-2 px-3 h-9 w-72 bg-surface-2 border border-border rounded-md text-sm">
        <Search className="size-4 text-fg-muted flex-shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search orders, products, customers…"
          className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-fg-muted text-fg"
          aria-label="Search the admin"
        />
        {loading ? (
          <Loader2 className="size-4 text-fg-muted animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="text-fg-muted hover:text-fg"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        ) : (
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-surface border border-border rounded text-fg-muted">
            ⌘K
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 w-[28rem] z-40 bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
          {loading && results.totalCount === 0 ? (
            <div className="p-6 text-sm text-fg-muted flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </div>
          ) : results.totalCount === 0 ? (
            <div className="p-6 text-sm text-fg-muted">
              No matches for &ldquo;{debounced.trim()}&rdquo;.
            </div>
          ) : (
            <div className="max-h-[32rem] overflow-y-auto py-1">
              <Group title="Orders" icon={ShoppingBag} hits={results.orders} onClick={() => setOpen(false)} />
              <Group title="Products" icon={Box} hits={results.products} onClick={() => setOpen(false)} />
              <Group title="Customers" icon={User} hits={results.customers} onClick={() => setOpen(false)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  icon: Icon,
  hits,
  onClick,
}: {
  title: string;
  icon: LucideIcon;
  hits: AdminSearchHit[];
  onClick: () => void;
}) {
  if (hits.length === 0) return null;
  return (
    <div>
      <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-fg-muted">
        <Icon className="size-3" />
        {title}
      </div>
      <ul>
        {hits.map((h) => (
          <li key={`${h.type}-${h.href}`}>
            <Link
              href={h.href}
              onClick={onClick}
              className="flex items-center gap-3 px-4 py-2 hover:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{h.primary}</div>
                <div className="text-xs text-fg-muted truncate">{h.secondary}</div>
              </div>
              {h.meta && (
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-fg-muted flex-shrink-0",
                  )}
                >
                  {h.meta}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
