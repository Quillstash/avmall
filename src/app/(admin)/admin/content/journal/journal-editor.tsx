"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { slugify } from "@/lib/slug";
import { EditorCard, SingleImageField } from "../editor-ui";

export interface JournalDraft {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImage: string;
  category: string;
  author: string;
  readTime: string;
  published: boolean;
  /** yyyy-mm-dd, or "" */
  publishedAt: string;
}

export function JournalEditor({ initial }: { initial: JournalDraft }) {
  const router = useRouter();
  const isEdit = !!initial.id;
  const [d, setD] = React.useState<JournalDraft>(initial);
  const [slugTouched, setSlugTouched] = React.useState(isEdit);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const set = <K extends keyof JournalDraft>(k: K, v: JournalDraft[K]) =>
    setD((p) => ({ ...p, [k]: v }));

  function onTitle(v: string) {
    setD((p) => ({ ...p, title: v, slug: slugTouched ? p.slug : slugify(v) }));
  }

  async function save() {
    if (!d.title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      const payload = {
        title: d.title,
        slug: d.slug || slugify(d.title),
        excerpt: d.excerpt,
        body: d.body,
        coverImage: d.coverImage || null,
        category: d.category,
        author: d.author || null,
        readTime: d.readTime || null,
        published: d.published,
        publishedAt: d.publishedAt ? new Date(d.publishedAt).toISOString() : null,
      };
      const res = await fetch(
        isEdit ? `/api/v1/admin/content/journal/${initial.id}` : "/api/v1/admin/content/journal",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) return toast.error(json?.error?.message ?? "Could not save post");
      toast.success(isEdit ? "Post saved" : "Post created");
      router.push("/admin/content/journal");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!isEdit || !confirm(`Delete "${d.title}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/admin/content/journal/${initial.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json?.error?.message ?? "Could not delete");
        return;
      }
      toast.success("Post deleted");
      router.push("/admin/content/journal");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
      <div className="flex flex-col gap-4">
        <EditorCard title="Post">
          <div className="grid gap-3">
            <Field id="j-title" label="Title" required>
              <Input id="j-title" value={d.title} onChange={(e) => onTitle(e.target.value)} placeholder="A morning at the workshop" />
            </Field>
            <Field id="j-slug" label="Slug" hint="The URL: /journal/<slug>">
              <Input
                id="j-slug"
                value={d.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
                className="font-mono"
              />
            </Field>
            <Field id="j-excerpt" label="Excerpt" hint="Short summary shown on the journal list">
              <Textarea id="j-excerpt" value={d.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
            </Field>
            <Field id="j-body" label="Body" hint="Markdown supported — headings (##), bold (**), lists, links">
              <Textarea id="j-body" value={d.body} onChange={(e) => set("body", e.target.value)} className="min-h-[320px] font-mono text-xs" />
            </Field>
          </div>
        </EditorCard>
      </div>

      <div className="flex flex-col gap-4">
        <EditorCard title="Publish">
          <div className="grid gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={d.published} onChange={(e) => set("published", e.target.checked)} className="size-4 accent-brand-primary" />
              <span className="text-sm font-semibold">Published</span>
            </label>
            <Field id="j-date" label="Publish date" hint="Blank = today when first published">
              <Input id="j-date" type="date" value={d.publishedAt} onChange={(e) => set("publishedAt", e.target.value)} />
            </Field>
            <Button onClick={save} loading={saving} disabled={saving} width="full">
              {saving ? "Saving…" : isEdit ? "Save post" : "Create post"}
            </Button>
            {isEdit && (
              <Button variant="ghost" onClick={remove} disabled={deleting} width="full" className="text-danger">
                <Trash2 className="size-3.5" /> {deleting ? "Deleting…" : "Delete post"}
              </Button>
            )}
          </div>
        </EditorCard>

        <EditorCard title="Details">
          <div className="grid gap-3">
            <Field id="j-cat" label="Category">
              <Input id="j-cat" value={d.category} onChange={(e) => set("category", e.target.value)} placeholder="Maker / Recipe" />
            </Field>
            <Field id="j-author" label="Author">
              <Input id="j-author" value={d.author} onChange={(e) => set("author", e.target.value)} />
            </Field>
            <Field id="j-read" label="Read time">
              <Input id="j-read" value={d.readTime} onChange={(e) => set("readTime", e.target.value)} placeholder="6 min read" />
            </Field>
          </div>
        </EditorCard>

        <EditorCard title="Cover image">
          <SingleImageField value={d.coverImage} onChange={(url) => set("coverImage", url)} scopeId={d.slug || "journal"} />
        </EditorCard>
      </div>
    </div>
  );
}
