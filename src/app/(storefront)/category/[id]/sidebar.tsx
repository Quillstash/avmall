"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Filter sidebar. State lives in the URL search params so the server
 * component renders the right slice on every change. We debounce text inputs
 * so each keystroke doesn't re-fetch.
 */
export function CategorySidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [minDraft, setMinDraft] = React.useState(
    searchParams.get("min") ?? "",
  );
  const [maxDraft, setMaxDraft] = React.useState(
    searchParams.get("max") ?? "",
  );
  const inStock = searchParams.get("inStock") === "1";
  const onSale = searchParams.get("onSale") === "1";

  function setParam(name: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value == null || value === "") {
      next.delete(name);
    } else {
      next.set(name, value);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  function applyPrice() {
    setParam("min", minDraft.trim() || null);
    setParam("max", maxDraft.trim() || null);
  }

  function clearAll() {
    setMinDraft("");
    setMaxDraft("");
    router.push(pathname);
  }

  const activeCount =
    Number(searchParams.get("min") ? 1 : 0) +
    Number(searchParams.get("max") ? 1 : 0) +
    Number(inStock ? 1 : 0) +
    Number(onSale ? 1 : 0);

  return (
    <div className="sticky top-28 flex flex-col gap-7 text-sm">
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] font-bold uppercase tracking-widest text-fg-muted">
          Filters {activeCount > 0 && <span className="text-brand-primary">· {activeCount}</span>}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] font-semibold text-fg-muted hover:text-fg"
          >
            Clear
          </button>
        )}
      </div>

      <FilterGroup title="Availability">
        <CheckRow
          checked={inStock}
          onChange={(c) => setParam("inStock", c ? "1" : null)}
          label="In stock only"
        />
        <CheckRow
          checked={onSale}
          onChange={(c) => setParam("onSale", c ? "1" : null)}
          label="On sale"
        />
      </FilterGroup>

      <FilterGroup title="Price (₦)">
        <div className="flex gap-2">
          <Input
            placeholder="Min"
            className="flex-1 h-9"
            inputMode="numeric"
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={applyPrice}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyPrice();
            }}
          />
          <Input
            placeholder="Max"
            className="flex-1 h-9"
            inputMode="numeric"
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={applyPrice}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyPrice();
            }}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={applyPrice}
          className="mt-2"
        >
          Apply
        </Button>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-fg-muted mb-3">
        {title}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  checked = false,
  onChange,
}: {
  label: string;
  checked?: boolean;
  onChange?: (c: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer text-sm hover:text-brand-primary">
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onChange?.(c === true)}
      />
      <span>{label}</span>
    </label>
  );
}
