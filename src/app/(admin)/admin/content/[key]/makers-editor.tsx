"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";
import type { MakersContent } from "@/lib/data/content";
import { EditorCard, RepeatableList, StringList, SaveBar } from "../editor-ui";

export function MakersEditor({ initial }: { initial: MakersContent }) {
  const [c, setC] = React.useState<MakersContent>(initial);
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof MakersContent>(k: K, v: MakersContent[K]) =>
    setC((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/content/makers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      const json = await res.json();
      if (!res.ok) return toast.error(json?.error?.message ?? "Could not save");
      toast.success("Makers page saved");
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
          <Field id="m-eb" label="Eyebrow">
            <Input id="m-eb" value={c.hero.eyebrow} onChange={(e) => set("hero", { ...c.hero, eyebrow: e.target.value })} />
          </Field>
          <Field id="m-t" label="Title">
            <Input id="m-t" value={c.hero.title} onChange={(e) => set("hero", { ...c.hero, title: e.target.value })} />
          </Field>
          <Field id="m-d" label="Description">
            <Textarea id="m-d" value={c.hero.description} onChange={(e) => set("hero", { ...c.hero, description: e.target.value })} />
          </Field>
        </div>
      </EditorCard>

      <EditorCard title="Onboarding CTA band" subtitle="The dark band at the top. Button links to your WhatsApp number (set in Settings).">
        <div className="grid gap-3">
          <Field id="m-cta-eb" label="Eyebrow">
            <Input id="m-cta-eb" value={c.onboardingCta.eyebrow} onChange={(e) => set("onboardingCta", { ...c.onboardingCta, eyebrow: e.target.value })} />
          </Field>
          <Field id="m-cta-t" label="Title">
            <Input id="m-cta-t" value={c.onboardingCta.title} onChange={(e) => set("onboardingCta", { ...c.onboardingCta, title: e.target.value })} />
          </Field>
          <Field id="m-cta-bl" label="Button label">
            <Input id="m-cta-bl" value={c.onboardingCta.buttonLabel} onChange={(e) => set("onboardingCta", { ...c.onboardingCta, buttonLabel: e.target.value })} />
          </Field>
        </div>
      </EditorCard>

      <EditorCard title="What you get" subtitle="Heading + benefit cards">
        <div className="grid gap-3">
          <Field id="m-bh" label="Heading">
            <Input id="m-bh" value={c.benefitsHeading} onChange={(e) => set("benefitsHeading", e.target.value)} />
          </Field>
          <Field label="Benefits">
            <RepeatableList
              items={c.benefits}
              onChange={(v) => set("benefits", v)}
              empty={{ title: "", body: "" }}
              addLabel="Add benefit"
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

      <EditorCard title="How onboarding works" subtitle="Numbered steps">
        <div className="grid gap-3">
          <Field id="m-sh" label="Heading">
            <Input id="m-sh" value={c.stepsHeading} onChange={(e) => set("stepsHeading", e.target.value)} />
          </Field>
          <Field label="Steps">
            <StringList items={c.steps} onChange={(v) => set("steps", v)} addLabel="Add step" multiline={false} />
          </Field>
        </div>
      </EditorCard>

      <EditorCard title="What we look for" subtitle="Bulleted list">
        <div className="grid gap-3">
          <Field id="m-lh" label="Heading">
            <Input id="m-lh" value={c.lookForHeading} onChange={(e) => set("lookForHeading", e.target.value)} />
          </Field>
          <Field label="Points">
            <StringList items={c.lookFor} onChange={(v) => set("lookFor", v)} addLabel="Add point" />
          </Field>
        </div>
      </EditorCard>

      <EditorCard title="Closing CTA">
        <div className="grid grid-cols-2 gap-3">
          <Field id="m-fi" label="Intro line">
            <Input id="m-fi" value={c.finalCta.intro} onChange={(e) => set("finalCta", { ...c.finalCta, intro: e.target.value })} />
          </Field>
          <Field id="m-fbl" label="Button label">
            <Input id="m-fbl" value={c.finalCta.buttonLabel} onChange={(e) => set("finalCta", { ...c.finalCta, buttonLabel: e.target.value })} />
          </Field>
        </div>
      </EditorCard>

      <SaveBar saving={saving} onSave={save} preview="/makers" />
    </div>
  );
}
