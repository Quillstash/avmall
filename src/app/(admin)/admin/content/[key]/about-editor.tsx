"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";
import type { AboutContent } from "@/lib/data/content";
import { EditorCard, RepeatableList, StringList, SaveBar, SingleImageField } from "../editor-ui";

export function AboutEditor({ initial }: { initial: AboutContent }) {
  const [c, setC] = React.useState<AboutContent>(initial);
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof AboutContent>(k: K, v: AboutContent[K]) =>
    setC((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/content/about", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      const json = await res.json();
      if (!res.ok) return toast.error(json?.error?.message ?? "Could not save");
      toast.success("About page saved");
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <EditorCard title="Hero">
        <div className="grid gap-3">
          <Field id="a-eyebrow" label="Eyebrow">
            <Input id="a-eyebrow" value={c.hero.eyebrow} onChange={(e) => set("hero", { ...c.hero, eyebrow: e.target.value })} />
          </Field>
          <Field id="a-title" label="Title">
            <Input id="a-title" value={c.hero.title} onChange={(e) => set("hero", { ...c.hero, title: e.target.value })} />
          </Field>
          <Field id="a-desc" label="Description">
            <Textarea id="a-desc" value={c.hero.description} onChange={(e) => set("hero", { ...c.hero, description: e.target.value })} />
          </Field>
        </div>
      </EditorCard>

      <EditorCard title="Story" subtitle="Heading + paragraphs">
        <div className="grid gap-3">
          <Field id="a-story-h" label="Heading">
            <Input id="a-story-h" value={c.storyHeading} onChange={(e) => set("storyHeading", e.target.value)} />
          </Field>
          <Field label="Paragraphs">
            <StringList items={c.storyParagraphs} onChange={(v) => set("storyParagraphs", v)} addLabel="Add paragraph" />
          </Field>
        </div>
      </EditorCard>

      <EditorCard title="What we stand for" subtitle="Section heading + pillar cards">
        <div className="grid gap-3">
          <Field id="a-pill-h" label="Heading">
            <Input id="a-pill-h" value={c.pillarsHeading} onChange={(e) => set("pillarsHeading", e.target.value)} />
          </Field>
          <Field label="Pillars">
            <RepeatableList
              items={c.pillars}
              onChange={(v) => set("pillars", v)}
              empty={{ title: "", body: "" }}
              addLabel="Add pillar"
              render={(item, update) => (
                <div className="grid gap-2">
                  <Input placeholder="Title" value={item.title} onChange={(e) => update({ title: e.target.value })} />
                  <Textarea placeholder="Body" value={item.body} onChange={(e) => update({ body: e.target.value })} />
                </div>
              )}
            />
          </Field>
        </div>
      </EditorCard>

      <EditorCard title="Maker CTA band">
        <div className="grid gap-3">
          <Field id="a-cta-eb" label="Eyebrow">
            <Input id="a-cta-eb" value={c.cta.eyebrow} onChange={(e) => set("cta", { ...c.cta, eyebrow: e.target.value })} />
          </Field>
          <Field id="a-cta-t" label="Title">
            <Input id="a-cta-t" value={c.cta.title} onChange={(e) => set("cta", { ...c.cta, title: e.target.value })} />
          </Field>
          <Field id="a-cta-b" label="Body">
            <Textarea id="a-cta-b" value={c.cta.body} onChange={(e) => set("cta", { ...c.cta, body: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="a-cta-bl" label="Button label">
              <Input id="a-cta-bl" value={c.cta.buttonLabel} onChange={(e) => set("cta", { ...c.cta, buttonLabel: e.target.value })} />
            </Field>
            <Field id="a-cta-bh" label="Button link">
              <Input id="a-cta-bh" value={c.cta.buttonHref} onChange={(e) => set("cta", { ...c.cta, buttonHref: e.target.value })} placeholder="/makers" />
            </Field>
          </div>
          <Field label="Background image" hint="Shown faded behind the band">
            <SingleImageField value={c.cta.imageUrl} onChange={(url) => set("cta", { ...c.cta, imageUrl: url })} scopeId="about" />
          </Field>
        </div>
      </EditorCard>

      <SaveBar saving={saving} onSave={save} preview="/about" />
    </div>
  );
}
