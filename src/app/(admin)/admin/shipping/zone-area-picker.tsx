"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { NIGERIA_LGAS } from "@/lib/nigeria-lgas";

/** A single (state, LGA) area this zone prices. */
export type ZoneArea = { state: string; lga: string };

const STATES = Object.keys(NIGERIA_LGAS);

/**
 * Picks specific LGAs (within states) that this zone prices, overriding the
 * whole-state rate. Each (state, LGA) can belong to only one zone — the server
 * rejects duplicates — so this is how admins carve out area-level pricing.
 */
export function ZoneAreaPicker({
  value,
  onChange,
}: {
  value: ZoneArea[];
  onChange: (next: ZoneArea[]) => void;
}) {
  const [pickState, setPickState] = React.useState("");

  const lgasForPick: readonly string[] = pickState
    ? (NIGERIA_LGAS[pickState] ?? [])
    : [];

  function toggleLga(state: string, lga: string) {
    const exists = value.some((a) => a.state === state && a.lga === lga);
    onChange(
      exists
        ? value.filter((a) => !(a.state === state && a.lga === lga))
        : [...value, { state, lga }],
    );
  }

  function clearState(state: string) {
    onChange(value.filter((a) => a.state !== state));
  }

  // Group the selected areas by state for the summary list.
  const byState = value.reduce<Record<string, string[]>>((acc, a) => {
    (acc[a.state] ??= []).push(a.lga);
    return acc;
  }, {});
  const groupedStates = Object.keys(byState).sort();

  const selectedForPick = new Set(
    value.filter((a) => a.state === pickState).map((a) => a.lga),
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-fg-muted">
        Optional. Charge a different rate for specific LGAs within a state — an
        LGA here overrides that state&rsquo;s whole-state rate. Leave empty to
        price the whole state the same.
      </p>

      <Field id="area-state" label="Pick a state to configure its LGAs">
        <Select
          id="area-state"
          value={pickState}
          onChange={(e) => setPickState(e.target.value)}
        >
          <option value="">Select a state…</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>

      {pickState && lgasForPick.length > 0 && (
        <div>
          <div className="text-xs text-fg-muted mb-2">
            LGAs in {pickState} priced by this zone ({selectedForPick.size}{" "}
            selected)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {lgasForPick.map((lga) => {
              const checked = selectedForPick.has(lga);
              return (
                <button
                  key={lga}
                  type="button"
                  onClick={() => toggleLga(pickState, lga)}
                  className={
                    checked
                      ? "text-xs font-semibold px-3 py-1.5 rounded-md bg-brand-primary text-brand-primary-fg text-left"
                      : "text-xs font-semibold px-3 py-1.5 rounded-md bg-surface-2 text-fg hover:bg-bg text-left"
                  }
                >
                  {checked && <X className="size-3 inline mr-1" />}
                  {lga}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {groupedStates.length > 0 && (
        <div className="rounded-md bg-surface-2 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-2">
            Area overrides on this zone
          </div>
          <div className="flex flex-col gap-2">
            {groupedStates.map((state) => (
              <div key={state} className="flex items-start justify-between gap-3">
                <div className="text-sm">
                  <span className="font-semibold">{state}:</span>{" "}
                  <span className="text-fg-muted">
                    {byState[state]!.join(", ")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => clearState(state)}
                  className="text-xs text-danger hover:underline flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
