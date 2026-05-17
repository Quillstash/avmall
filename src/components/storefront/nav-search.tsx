"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import type { ProductSearchHit } from "@/lib/data/products";

interface NavSearchProps {
  /** When true, renders a full-screen overlay variant for mobile. */
  variant?: "inline" | "overlay";
  /** Called when the user dismisses the overlay (overlay variant only). */
  onClose?: () => void;
}

export function NavSearch({ variant = "inline", onClose }: NavSearchProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(variant === "overlay");
  const [results, setResults] = React.useState<ProductSearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounced = useDebouncedValue(query, 250);

  // Autofocus overlay variant
  React.useEffect(() => {
    if (variant === "overlay") inputRef.current?.focus();
  }, [variant]);

  // Fetch results on debounced query change
  React.useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/v1/search?q=${encodeURIComponent(q)}&limit=8`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((json: { data?: { products?: ProductSearchHit[] } }) => {
        setResults(json.data?.products ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setLoading(false);
      });
    return () => ctrl.abort();
  }, [debounced]);

  // Close on click-outside (inline variant only)
  React.useEffect(() => {
    if (variant !== "inline") return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [variant]);

  function submit() {
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setOpen(false);
    onClose?.();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      if (variant === "overlay") onClose?.();
      else setOpen(false);
    }
  }

  const showDropdown = open && debounced.trim().length >= 2;

  const input = (
    <div
      className={cn(
        "flex items-center gap-2 px-4 h-10 bg-surface-2 rounded-full text-sm",
        variant === "inline" && "w-72 lg:w-80",
        variant === "overlay" && "w-full",
      )}
    >
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
        onKeyDown={onKey}
        placeholder="Search products, brands…"
        className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-fg-muted text-fg"
        aria-label="Search products"
      />
      {loading && <Loader2 className="size-4 text-fg-muted animate-spin" />}
      {query && !loading && (
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
      )}
    </div>
  );

  const dropdown = showDropdown && (
    <div
      className={cn(
        "z-40 bg-surface border border-border rounded-lg shadow-lg overflow-hidden",
        variant === "inline" && "absolute top-full right-0 mt-2 w-96",
        variant === "overlay" && "mt-3 w-full",
      )}
    >
      {loading && results.length === 0 ? (
        <div className="p-6 text-sm text-fg-muted flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Searching…
        </div>
      ) : results.length === 0 ? (
        <div className="p-6 text-sm text-fg-muted">
          No matches for &ldquo;{debounced.trim()}&rdquo;. Try a different keyword.
        </div>
      ) : (
        <>
          <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-fg-muted">
            Products
          </div>
          <ul className="py-1 max-h-[28rem] overflow-y-auto">
            {results.map((p) => {
              const unit = p.saleActive && p.saleKobo != null ? p.saleKobo : p.priceKobo;
              return (
                <li key={p.id}>
                  <Link
                    href={`/product/${p.slug}`}
                    onClick={() => {
                      setOpen(false);
                      onClose?.();
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
                  >
                    <div className="relative size-12 rounded-md overflow-hidden bg-surface-2 flex-shrink-0">
                      <Image
                        src={p.imageUrl}
                        alt={p.name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                        {p.brand}
                      </div>
                      <div className="text-sm font-semibold truncate">{p.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Money kobo={unit} className="text-sm font-bold" />
                      {p.saleActive && p.saleKobo != null && (
                        <Money
                          kobo={p.priceKobo}
                          variant="strikethrough"
                          className="block text-[11px]"
                        />
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={submit}
            className="w-full px-4 py-3 text-sm font-semibold text-brand-primary hover:bg-surface-2 border-t border-border text-left"
          >
            See all results for &ldquo;{debounced.trim()}&rdquo;
          </button>
        </>
      )}
    </div>
  );

  if (variant === "overlay") {
    return (
      <div className="fixed inset-0 z-50 bg-fg/50 flex items-start justify-center pt-20 px-4">
        <div className="w-full max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="flex-1">{input}</div>
            <button
              onClick={onClose}
              className="size-10 rounded-full bg-surface text-fg flex items-center justify-center"
              aria-label="Close search"
            >
              <X className="size-5" />
            </button>
          </div>
          {dropdown}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative hidden md:block">
      {input}
      {dropdown}
    </div>
  );
}
