"use client";

import * as React from "react";
import {
  Sparkles,
  Pencil,
  Coins,
  Boxes,
  Archive,
  ArchiveRestore,
  Trash2,
  Copy,
  Image as ImageIcon,
  Activity as ActivityIcon,
  UserPlus,
  PackagePlus,
} from "lucide-react";
import type { ProductActivity as ProductActivityData } from "@/lib/data/product-history";

const dt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric", month: "short", year: "numeric",
  hour: "numeric", minute: "2-digit",
  timeZone: "Africa/Lagos",
});
const fmt = (iso: string | null) => (iso ? dt.format(new Date(iso)) : "—");

const ICONS: Record<string, typeof Pencil> = {
  "product.create": Sparkles,
  "product.update": Pencil,
  "product.price.change": Coins,
  "product.stock_adjust": Boxes,
  "product.archive": Archive,
  "product.unarchive": ArchiveRestore,
  "product.delete": Trash2,
  "product.duplicate": Copy,
  "asset.upload": ImageIcon,
};

export function ProductActivity({ activity }: { activity: ProductActivityData }) {
  const { addedBy, events } = activity;

  const origin =
    addedBy.via === "staff"
      ? { icon: UserPlus, text: <>Added by <b>{addedBy.name}</b></> }
      : addedBy.via === "bumpa"
        ? { icon: PackagePlus, text: <>Bulk-imported</> }
        : { icon: PackagePlus, text: <>In the catalogue</> };
  const OriginIcon = origin.icon;

  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <ActivityIcon className="size-4 text-brand-primary" />
        <div className="text-sm font-bold">Activity</div>
        {events.length > 0 && (
          <span className="text-xs text-fg-muted">· {events.length} event{events.length === 1 ? "" : "s"}</span>
        )}
      </div>

      <div className="p-4">
        {/* Provenance banner */}
        <div className="flex items-center gap-2.5 rounded-md bg-surface-2 px-3 py-2.5 mb-4">
          <div className="size-8 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
            <OriginIcon className="size-4" />
          </div>
          <div className="text-sm">
            <div>{origin.text}</div>
            <div className="text-[11px] text-fg-muted">{fmt(addedBy.at)}</div>
          </div>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-fg-muted text-center py-2">No changes recorded yet.</p>
        ) : (
          <ol className="relative flex flex-col gap-3.5 before:absolute before:left-[11px] before:top-1 before:bottom-1 before:w-px before:bg-border">
            {events.map((e, i) => {
              const Icon = ICONS[e.action] ?? Pencil;
              return (
                <li key={i} className="relative flex gap-3">
                  <div className="relative z-10 size-6 rounded-full bg-surface border border-border-strong flex items-center justify-center flex-shrink-0 text-fg-muted">
                    <Icon className="size-3" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                      <span className="font-semibold">{e.label}</span>
                      <span className="text-fg-muted">
                        by {e.actor ?? (e.actorType === "system" ? "system" : "—")}
                      </span>
                      <span className="text-[11px] text-fg-subtle">· {fmt(e.at)}</span>
                    </div>
                    {e.changes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {e.changes.map((c) => (
                          <span
                            key={c.field}
                            className="inline-flex items-center gap-1 text-[11px] rounded-full bg-surface-2 px-2 py-0.5"
                          >
                            <span className="text-fg-muted">{c.field}</span>
                            <span className="text-fg-subtle line-through">{c.from}</span>
                            <span aria-hidden>→</span>
                            <span className="font-semibold text-fg">{c.to}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

ProductActivity.displayName = "ProductActivity";
