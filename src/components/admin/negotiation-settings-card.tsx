"use client";

import * as React from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";

interface AiSettings {
  globalNegotiateMaxPct: number;
  negotiationEnabled: boolean;
}

export function NegotiationSettingsCard() {
  const [pct, setPct] = React.useState<number>(10);
  const [enabled, setEnabled] = React.useState(true);
  const [initialPct, setInitialPct] = React.useState<number>(10);
  const [initialEnabled, setInitialEnabled] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/v1/admin/settings/ai", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json: { data?: AiSettings }) => {
        const s = json.data;
        if (s) {
          setPct(s.globalNegotiateMaxPct);
          setEnabled(s.negotiationEnabled);
          setInitialPct(s.globalNegotiateMaxPct);
          setInitialEnabled(s.negotiationEnabled);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  const dirty = pct !== initialPct || enabled !== initialEnabled;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          globalNegotiateMaxPct: pct,
          negotiationEnabled: enabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not save");
        return;
      }
      setInitialPct(json.data.globalNegotiateMaxPct);
      setInitialEnabled(json.data.negotiationEnabled);
      toast.success("Negotiation settings updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="size-9 rounded-md bg-info-bg text-brand-primary flex items-center justify-center">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Negotiation settings</h3>
          <p className="text-xs text-fg-muted">
            Site-wide defaults. Per-product overrides on the product page win.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-fg-muted py-4">
          <Loader2 className="size-4 animate-spin" /> Loading current settings…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex items-center justify-between gap-3 p-3 rounded-md bg-surface-2">
            <div>
              <div className="text-sm font-semibold">Negotiation enabled</div>
              <div className="text-xs text-fg-muted">
                Master switch. When off, the AI refuses every counter-offer.
              </div>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-5 rounded accent-brand-primary"
              aria-label="Toggle negotiation"
            />
          </label>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-fg-muted block mb-1.5">
              Global max % off retail
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={50}
                value={pct}
                onChange={(e) =>
                  setPct(Math.max(0, Math.min(50, parseInt(e.target.value || "0", 10))))
                }
                className="w-24 tabular"
                disabled={!enabled}
              />
              <span className="text-sm text-fg-muted">%</span>
              <span className="text-xs text-fg-subtle ml-2">
                AI will settle no lower than {100 - pct}% of retail by default.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {dirty && (
              <span className="text-xs text-warning font-semibold">Unsaved</span>
            )}
            <Button onClick={save} disabled={!dirty || saving} size="sm">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              <Save className="size-3.5" /> Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
