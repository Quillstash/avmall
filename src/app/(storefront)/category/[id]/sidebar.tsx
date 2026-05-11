"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const BRANDS = [
  "Aramide",
  "Omolewa",
  "Tafa Studio",
  "Ade & Co.",
  "Kola Roasters",
  "Pneuma",
  "Iba Atelier",
  "Bauchi Glass",
];

export function CategorySidebar() {
  const [inStock, setInStock] = React.useState(false);
  const [onSale, setOnSale] = React.useState(false);

  return (
    <div className="sticky top-28 flex flex-col gap-7 text-sm">
      <FilterGroup title="Availability">
        <CheckRow checked={inStock} onChange={setInStock} label="In stock only" />
        <CheckRow checked={onSale} onChange={setOnSale} label="On sale" />
      </FilterGroup>

      <FilterGroup title="Price (₦)">
        <div className="flex gap-2">
          <Input placeholder="Min" className="flex-1 h-9" inputMode="numeric" />
          <Input placeholder="Max" className="flex-1 h-9" inputMode="numeric" />
        </div>
      </FilterGroup>

      <FilterGroup title="Brand">
        <div className="flex flex-col gap-2.5">
          {BRANDS.slice(0, 6).map((b) => (
            <CheckRow key={b} label={b} />
          ))}
        </div>
        <button className="text-xs font-semibold text-brand-primary hover:underline mt-2">
          Show all brands
        </button>
      </FilterGroup>

      <FilterGroup title="Rating">
        {[4, 3].map((r) => (
          <CheckRow key={r} label={`${r}★ & up`} />
        ))}
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
