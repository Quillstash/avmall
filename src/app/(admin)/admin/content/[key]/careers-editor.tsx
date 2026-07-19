"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";
import type { CareersContent } from "@/lib/data/content";
import { EditorCard, RepeatableList, SaveBar } from "../editor-ui";

export function CareersEditor({ initial }: { initial: CareersContent }) {
  const [c, setC] = React.useState<CareersContent>(initial);
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof CareersContent>(k: K, v: CareersContent[K]) =>
    setC((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/content/careers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      const json = await res.json();
      if (!res.ok) return toast.error(json?.error?.message ?? "Could not save");
      toast.success("Careers page saved");
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
          <Field id="c-eb" label="Eyebrow">
            <Input id="c-eb" value={c.hero.eyebrow} onChange={(e) => set("hero", { ...c.hero, eyebrow: e.target.value })} />
          </Field>
          <Field id="c-t" label="Title">
            <Input id="c-t" value={c.hero.title} onChange={(e) => set("hero", { ...c.hero, title: e.target.value })} />
          </Field>
          <Field id="c-d" label="Description">
            <Textarea id="c-d" value={c.hero.description} onChange={(e) => set("hero", { ...c.hero, description: e.target.value })} />
          </Field>
        </div>
      </EditorCard>

      <EditorCard title="How we work" subtitle="Heading + value cards">
        <div className="grid gap-3">
          <Field id="c-vh" label="Heading">
            <Input id="c-vh" value={c.valuesHeading} onChange={(e) => set("valuesHeading", e.target.value)} />
          </Field>
          <Field label="Values">
            <RepeatableList
              items={c.values}
              onChange={(v) => set("values", v)}
              empty={{ title: "", body: "" }}
              addLabel="Add value"
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

      <EditorCard title="Open roles">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field id="c-rh" label="Heading">
              <Input id="c-rh" value={c.rolesHeading} onChange={(e) => set("rolesHeading", e.target.value)} />
            </Field>
            <Field id="c-ru" label="Updated date" hint="Shown next to the role count">
              <Input id="c-ru" value={c.rolesUpdated} onChange={(e) => set("rolesUpdated", e.target.value)} placeholder="1 May 2026" />
            </Field>
          </div>
          <Field label="Roles" hint="Apply buttons email your business address">
            <RepeatableList
              items={c.roles}
              onChange={(v) => set("roles", v)}
              empty={{ title: "", team: "", location: "", type: "", body: "" }}
              addLabel="Add role"
              itemLabel={(i) => `Role ${i + 1}`}
              render={(item, update) => (
                <div className="grid gap-2">
                  <Input placeholder="Title" value={item.title} onChange={(e) => update({ title: e.target.value })} />
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Team" value={item.team} onChange={(e) => update({ team: e.target.value })} />
                    <Input placeholder="Location" value={item.location} onChange={(e) => update({ location: e.target.value })} />
                    <Input placeholder="Type" value={item.type} onChange={(e) => update({ type: e.target.value })} />
                  </div>
                  <Textarea placeholder="Description" value={item.body} onChange={(e) => update({ body: e.target.value })} />
                </div>
              )}
            />
          </Field>
        </div>
      </EditorCard>

      <EditorCard title="Speculative-application band">
        <div className="grid gap-3">
          <Field id="c-st" label="Title">
            <Input id="c-st" value={c.speculative.title} onChange={(e) => set("speculative", { ...c.speculative, title: e.target.value })} />
          </Field>
          <Field id="c-sb" label="Body">
            <Textarea id="c-sb" value={c.speculative.body} onChange={(e) => set("speculative", { ...c.speculative, body: e.target.value })} />
          </Field>
          <Field id="c-sbl" label="Button label">
            <Input id="c-sbl" value={c.speculative.buttonLabel} onChange={(e) => set("speculative", { ...c.speculative, buttonLabel: e.target.value })} />
          </Field>
        </div>
      </EditorCard>

      <SaveBar saving={saving} onSave={save} preview="/careers" />
    </div>
  );
}
