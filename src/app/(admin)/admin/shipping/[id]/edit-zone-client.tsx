"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, Save } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "@/components/ui/toaster";
import { NIGERIAN_STATES } from "@/lib/mock-data";

interface ZoneInput {
  id: string;
  name: string;
  states: string[];
  baseRateKobo: number;
  freeOverKobo: number | null;
  etaDays: string;
  active: boolean;
}

export function EditZoneClient({ zone }: { zone: ZoneInput }) {
  const router = useRouter();
  const [name, setName] = React.useState(zone.name);
  const [states, setStates] = React.useState<string[]>([...zone.states]);
  const [baseRateKobo, setBaseRateKobo] = React.useState<number | null>(
    zone.baseRateKobo,
  );
  const [freeOverEnabled, setFreeOverEnabled] = React.useState(
    zone.freeOverKobo != null,
  );
  const [freeOverKobo, setFreeOverKobo] = React.useState<number | null>(
    zone.freeOverKobo,
  );
  const [etaDays, setEtaDays] = React.useState(zone.etaDays);
  const [active, setActive] = React.useState(zone.active);
  const [saving, setSaving] = React.useState(false);

  function toggleState(state: string) {
    setStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state],
    );
  }
  function selectAll() {
    setStates([...NIGERIAN_STATES]);
  }
  function clearAll() {
    setStates([]);
  }

  async function save() {
    if (!name.trim() || states.length === 0 || baseRateKobo == null || !etaDays.trim()) {
      toast.error("Name, base rate, ETA and at least one state are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/shipping/zones/${zone.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          states,
          baseRateKobo,
          freeOverKobo: freeOverEnabled ? freeOverKobo : null,
          etaDays: etaDays.trim(),
          active,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not save zone");
        return;
      }
      toast.success(`Zone "${name.trim()}" saved`);
      router.push("/admin/shipping");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Shipping zones", href: "/admin/shipping" },
          { label: zone.name },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1000px] mx-auto pb-20">
          <PageHeader
            title={`Edit zone — ${zone.name}`}
            subtitle="Updates take effect immediately for new orders"
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/shipping")}
              >
                Cancel
              </Button>
            }
          />

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            <div className="flex flex-col gap-4">
              <Card title="Basics">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field id="name" label="Zone name" required>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field id="eta" label="ETA" required hint="Visible to customers">
                    <Input
                      id="eta"
                      value={etaDays}
                      onChange={(e) => setEtaDays(e.target.value)}
                    />
                  </Field>
                </div>
              </Card>

              <Card title="Coverage">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-fg-muted">
                    {states.length} of {NIGERIAN_STATES.length} states
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={selectAll}>
                      Select all
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {NIGERIAN_STATES.map((s) => {
                    const checked = states.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleState(s)}
                        className={
                          checked
                            ? "text-xs font-semibold px-3 py-1.5 rounded-md bg-brand-primary text-brand-primary-fg text-left"
                            : "text-xs font-semibold px-3 py-1.5 rounded-md bg-surface-2 text-fg hover:bg-bg text-left"
                        }
                      >
                        {checked && <X className="size-3 inline mr-1" />}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card title="Rates">
                <Field
                  id="base"
                  label="Base rate"
                  required
                  hint="One flat price for every state in this zone"
                >
                  <CurrencyInput
                    id="base"
                    {...(baseRateKobo != null ? { valueKobo: baseRateKobo } : {})}
                    onValueChange={(v) => setBaseRateKobo(v)}
                  />
                </Field>
                <div className="mt-4 p-3 rounded-md bg-surface-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={freeOverEnabled}
                      onChange={(e) => setFreeOverEnabled(e.target.checked)}
                      className="size-4 accent-brand-primary"
                    />
                    <span className="text-sm font-semibold">
                      Offer free shipping above a threshold
                    </span>
                  </label>
                  {freeOverEnabled && (
                    <div className="mt-3">
                      <CurrencyInput
                        {...(freeOverKobo != null ? { valueKobo: freeOverKobo } : {})}
                        onValueChange={(v) => setFreeOverKobo(v)}
                      />
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card title="Status">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="size-4 mt-1 accent-brand-primary"
                  />
                  <div>
                    <div className="text-sm font-semibold">Active</div>
                    <div className="text-xs text-fg-muted">
                      Inactive zones never match at checkout.
                    </div>
                  </div>
                </label>
              </Card>

              <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                <Button width="full" disabled={saving} onClick={save}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  <Save className="size-3.5" />
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-bold">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
