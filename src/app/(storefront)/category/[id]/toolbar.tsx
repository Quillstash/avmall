"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, LayoutGrid, List } from "lucide-react";
import { Select } from "@/components/ui/select";

export function CategoryToolbar({ count }: { count: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Sort lives in the URL so the server component re-renders the sorted slice.
  const sort = searchParams.get("sort") ?? "featured";
  const [view, setView] = React.useState<"grid" | "list">("grid");

  function setSort(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "featured") next.delete("sort");
    else next.set("sort", value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
      <div className="flex items-center gap-3">
        <button className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border-strong bg-surface text-sm font-semibold">
          <SlidersHorizontal className="size-3.5" /> Filters
        </button>
        <span className="text-xs text-fg-muted">
          Showing <span className="font-semibold text-fg tabular">{count}</span> results
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-9 text-sm w-44"
          aria-label="Sort products"
        >
          <option value="featured">Featured</option>
          <option value="lo">Price: low to high</option>
          <option value="hi">Price: high to low</option>
          <option value="new">Newest</option>
        </Select>
        <div className="hidden lg:inline-flex border border-border-strong rounded-md overflow-hidden">
          <button
            onClick={() => setView("grid")}
            aria-label="Grid view"
            className={`flex items-center justify-center size-9 ${
              view === "grid" ? "bg-surface-2 text-fg" : "bg-surface text-fg-muted"
            }`}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            onClick={() => setView("list")}
            aria-label="List view"
            className={`flex items-center justify-center size-9 border-l border-border-strong ${
              view === "list" ? "bg-surface-2 text-fg" : "bg-surface text-fg-muted"
            }`}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
