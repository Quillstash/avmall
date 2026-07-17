"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, AlertTriangle, MapPin, Loader2 } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { CouriersSection } from "./couriers-section";
import type {
  ShippingZoneView,
  FallbackShippingView,
  CourierView,
} from "@/lib/data/shipping";

interface ShippingClientProps {
  initialZones: ShippingZoneView[];
  initialFallback: FallbackShippingView | null;
  initialCouriers: CourierView[];
}

export function ShippingClient({
  initialZones,
  initialFallback,
  initialCouriers,
}: ShippingClientProps) {
  const router = useRouter();
  const [zones, setZones] = React.useState<ShippingZoneView[]>(initialZones);
  const [fallbackEnabled, setFallbackEnabled] = React.useState(
    initialFallback?.enabled ?? true,
  );
  const [fallbackKobo, setFallbackKobo] = React.useState<number | null>(
    initialFallback?.flatRateKobo ?? 900000,
  );
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const hasOverlap = zones.some(
    (z) => z.active && z.overlapsWith && z.overlapsWith.length > 0,
  );

  async function toggleActive(id: string, next: boolean) {
    setTogglingId(id);
    // Optimistic update
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, active: next } : z)));
    try {
      const res = await fetch(`/api/v1/admin/shipping/zones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json?.error?.message ?? "Could not update");
        // Roll back
        setZones((prev) =>
          prev.map((z) => (z.id === id ? { ...z, active: !next } : z)),
        );
      } else {
        toast.success(next ? "Zone activated" : "Zone paused");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
      setZones((prev) =>
        prev.map((z) => (z.id === id ? { ...z, active: !next } : z)),
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteZone(id: string, name: string) {
    if (!confirm(`Delete zone "${name}"? This can't be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/admin/shipping/zones/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not delete");
        return;
      }
      setZones((prev) => prev.filter((z) => z.id !== id));
      toast.success(`Deleted ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Shipping zones" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Shipping zones"
            subtitle="Configure rates and ETAs by state — addresses without a zone fall back to the flat rate (or an explicit error)"
            actions={
              <Link href="/admin/shipping/new">
                <Button size="sm">
                  <Plus className="size-3.5" /> New zone
                </Button>
              </Link>
            }
          />

          {hasOverlap && (
            <Alert
              tone="warning"
              icon={<AlertTriangle className="size-5" />}
              title="Overlapping zones detected"
              description="Two or more active zones claim the same whole state (or price the same LGA). To charge different rates within one state, give each zone a specific LGA under “Area pricing (specific LGAs)” and deselect the whole state — an LGA price overrides the state price, so those zones won't collide. Otherwise merge or deactivate the duplicate so checkout stays unambiguous."
              className="mb-5"
            />
          )}

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              {zones.length === 0 ? (
                <div className="p-10 text-center text-sm text-fg-muted">
                  No shipping zones yet.{" "}
                  <Link
                    href="/admin/shipping/new"
                    className="text-brand-primary font-semibold hover:underline"
                  >
                    Add your first one →
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px] stack-table">
                  <thead className="bg-surface-2">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                      <th className="text-left px-3.5 py-2.5">Zone</th>
                      <th className="text-left px-3.5 py-2.5">Coverage</th>
                      <th className="text-right px-3.5 py-2.5">Base rate</th>
                      <th className="text-right px-3.5 py-2.5">Free over</th>
                      <th className="text-left px-3.5 py-2.5">ETA</th>
                      <th className="text-left px-3.5 py-2.5">Active</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map((z) => (
                      <tr key={z.id} className="border-t border-border hover:bg-surface-2">
                        <td data-label="Zone" className="px-3.5 py-3">
                          <div className="flex items-center gap-2.5">
                            <MapPin className="size-4 text-fg-muted flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-semibold">{z.name}</div>
                              {z.overlapsWith && z.overlapsWith.length > 0 && (
                                <div className="text-[10px] text-warning font-semibold mt-0.5 inline-flex items-center gap-1">
                                  <AlertTriangle className="size-2.5" /> overlaps another zone
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td data-label="Coverage" className="px-3.5 py-3 text-xs text-fg-muted lg:max-w-[280px]">
                          {z.states.length > 4
                            ? `${z.states.slice(0, 4).join(", ")} + ${z.states.length - 4} more`
                            : z.states.join(", ")}
                          {z.states.length === 0 && z.areas.length === 0 && "—"}
                          {z.areas.length > 0 && (
                            <div className="text-[10px] text-fg-subtle mt-0.5">
                              {z.areas
                                .slice(0, 3)
                                .map((a) => `${a.lga} (${a.state})`)
                                .join(", ")}
                              {z.areas.length > 3
                                ? ` +${z.areas.length - 3} more`
                                : ""}
                            </div>
                          )}
                        </td>
                        <td data-label="Base rate" className="px-3.5 py-3 text-right">
                          <Money kobo={z.baseRateKobo} className="font-bold" />
                        </td>
                        <td data-label="Free over" className="px-3.5 py-3 text-right">
                          {z.freeOverKobo != null ? (
                            <Money kobo={z.freeOverKobo} />
                          ) : (
                            <span className="text-fg-subtle">—</span>
                          )}
                        </td>
                        <td data-label="ETA" className="px-3.5 py-3 text-xs">{z.etaDays}</td>
                        <td data-label="Active" className="px-3.5 py-3">
                          <div className="inline-flex items-center gap-2">
                            <Switch
                              checked={z.active}
                              onCheckedChange={(v) => toggleActive(z.id, v)}
                              disabled={togglingId === z.id}
                            />
                            {togglingId === z.id && (
                              <Loader2 className="size-3.5 animate-spin text-fg-muted" />
                            )}
                          </div>
                        </td>
                        <td data-label="Actions" className="px-3.5 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="inline-flex items-center gap-1 rounded-md text-fg-muted hover:text-fg hover:bg-surface px-2 py-1.5 border border-border-strong lg:border-0 lg:p-1.5"
                                aria-label="Row actions"
                                disabled={deletingId === z.id}
                              >
                                <span className="lg:hidden text-xs font-semibold text-fg">
                                  Manage
                                </span>
                                <MoreHorizontal className="size-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/admin/shipping/${z.id}`)
                                }
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onClick={() => deleteZone(z.id, z.name)}
                              >
                                Delete zone
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <Card title="Fallback rate">
                <p className="text-xs text-fg-muted leading-relaxed mb-3">
                  Used when a customer&apos;s state doesn&apos;t match any active zone. Disable to
                  show an explicit error with a WhatsApp contact CTA at checkout instead.
                </p>
                <label className="flex items-center gap-2.5 mb-3 cursor-pointer">
                  <Switch
                    checked={fallbackEnabled}
                    onCheckedChange={setFallbackEnabled}
                  />
                  <span className="text-sm font-semibold">Enabled</span>
                </label>
                {fallbackEnabled ? (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted mb-1.5">
                      Flat rate
                    </div>
                    <CurrencyInput
                      {...(fallbackKobo != null ? { valueKobo: fallbackKobo } : {})}
                      onValueChange={setFallbackKobo}
                    />
                    <div className="text-xs text-fg-muted mt-2">
                      {initialFallback?.etaDays ?? "5–7 business days"}
                    </div>
                  </div>
                ) : (
                  <Alert
                    tone="info"
                    title="Customers will see an error"
                    description="At checkout, customers with no matching zone get an explicit error with a WhatsApp contact CTA."
                  />
                )}
              </Card>

              <CouriersSection couriers={initialCouriers} />
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
