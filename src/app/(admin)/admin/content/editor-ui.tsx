"use client";

import * as React from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";

/** One optional image, backed by the R2 uploader. Bridges a plain URL string
 *  to the uploader's image-list shape. */
export function SingleImageField({
  value,
  onChange,
  scopeId,
}: {
  value: string;
  onChange: (url: string) => void;
  scopeId: string;
}) {
  const images: UploadedImage[] = value
    ? [{ id: value, url: value, key: value }]
    : [];
  return (
    <ImageUploader
      images={images}
      onChange={(next) => onChange(next[0]?.url ?? "")}
      scope="content"
      scopeId={scopeId}
      max={1}
    />
  );
}

/** Titled section card — mirrors the settings page's Card. */
export function EditorCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-bold">{title}</div>
        {subtitle && <div className="text-xs text-fg-muted mt-0.5">{subtitle}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/**
 * Generic editable list: add / remove / reorder rows. `render` draws each row's
 * fields and calls `update` with a partial patch.
 */
export function RepeatableList<T>({
  items,
  onChange,
  empty,
  render,
  addLabel = "Add item",
  itemLabel,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  empty: T;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode;
  addLabel?: string;
  itemLabel?: (index: number) => string;
}) {
  function update(i: number, patch: Partial<T>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-border bg-surface-2/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
              {itemLabel ? itemLabel(i) : `Item ${i + 1}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-1 rounded hover:bg-surface-2 disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                className="p-1 rounded hover:bg-surface-2 disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-1 rounded hover:bg-danger-bg text-danger"
                aria-label="Remove"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          {render(item, (patch) => update(i, patch), i)}
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, structuredClone(empty)])}
        >
          <Plus className="size-3.5" /> {addLabel}
        </Button>
      </div>
    </div>
  );
}

/** Editable list of plain strings (paragraphs, steps, bullets). */
export function StringList({
  items,
  onChange,
  addLabel = "Add",
  multiline = true,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  addLabel?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  function set(i: number, v: string) {
    onChange(items.map((it, idx) => (idx === i ? v : it)));
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    onChange(next);
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          {multiline ? (
            <Textarea
              value={item}
              placeholder={placeholder}
              onChange={(e) => set(i, e.target.value)}
              className="min-h-16"
            />
          ) : (
            <Input value={item} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
          )}
          <div className="flex flex-col">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-surface-2 disabled:opacity-30" aria-label="Move up">
              <ChevronUp className="size-4" />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-1 rounded hover:bg-surface-2 disabled:opacity-30" aria-label="Move down">
              <ChevronDown className="size-4" />
            </button>
            <button type="button" onClick={() => remove(i)} className="p-1 rounded hover:bg-danger-bg text-danger" aria-label="Remove">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}
      <div>
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...items, ""])}>
          <Plus className="size-3.5" /> {addLabel}
        </Button>
      </div>
    </div>
  );
}

/** Sticky-ish save button row used at the bottom of each editor. */
export function SaveBar({
  saving,
  onSave,
  preview,
}: {
  saving: boolean;
  onSave: () => void;
  preview?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      {preview && (
        <a
          href={preview}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-brand-primary hover:underline"
        >
          Preview page ↗
        </a>
      )}
      <Button onClick={onSave} loading={saving} disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
