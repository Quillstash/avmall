import { Plus, MoreHorizontal, AlertTriangle, MapPin } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { SHIPPING_ZONES } from "@/lib/admin-mock-data";

export default function AdminShippingPage() {
  const hasOverlap = SHIPPING_ZONES.some((z) => z.overlapsWith && z.overlapsWith.length > 0);

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Shipping zones" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Shipping zones"
            subtitle="Configure rates and ETAs by state — addresses without a zone fall back to flat rate"
            actions={
              <Button size="sm">
                <Plus className="size-3.5" /> New zone
              </Button>
            }
          />

          {hasOverlap && (
            <div className="mb-5 p-4 rounded-md bg-warning-bg border border-warning/30 flex items-start gap-3">
              <AlertTriangle className="size-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-sm text-warning mb-1">Overlapping zones detected</div>
                <p className="text-xs text-fg-muted leading-relaxed">
                  Two zones cover Lagos. The first match (by priority) wins at checkout. Deactivate
                  or merge the overlapping zone to prevent surprises.
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-warning">
                Resolve →
              </Button>
            </div>
          )}

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <th className="text-left px-3.5 py-2.5">Zone</th>
                    <th className="text-left px-3.5 py-2.5">Coverage</th>
                    <th className="text-right px-3.5 py-2.5">Base rate</th>
                    <th className="text-right px-3.5 py-2.5">Free over</th>
                    <th className="text-left px-3.5 py-2.5">ETA</th>
                    <th className="text-left px-3.5 py-2.5">Status</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {SHIPPING_ZONES.map((z) => (
                    <tr key={z.id} className="border-t border-border hover:bg-surface-2">
                      <td className="px-3.5 py-3">
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
                      <td className="px-3.5 py-3 text-xs text-fg-muted max-w-[280px]">
                        {z.states.length > 4
                          ? `${z.states.slice(0, 4).join(", ")} + ${z.states.length - 4} more`
                          : z.states.join(", ")}
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <Money kobo={z.baseRateKobo} className="font-bold" />
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        {z.freeOverKobo != null ? (
                          <Money kobo={z.freeOverKobo} />
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-xs">{z.etaDays}</td>
                      <td className="px-3.5 py-3">
                        <Badge tone={z.active ? "success" : "neutral"}>
                          {z.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <button
                          className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4">
              <Card title="Fallback rate">
                <p className="text-xs text-fg-muted leading-relaxed mb-3">
                  Used when a customer&apos;s state doesn&apos;t match any active zone. Set to{" "}
                  <span className="font-semibold">disabled</span> to instead show an explicit error
                  with a WhatsApp contact CTA at checkout.
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <input type="checkbox" defaultChecked className="accent-brand-primary" />
                  <span className="text-sm font-semibold">Enabled</span>
                </div>
                <div className="rounded-md border border-border bg-surface-2 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted mb-1">
                    Flat rate
                  </div>
                  <div className="text-xl font-bold tabular">₦9,000</div>
                  <div className="text-xs text-fg-muted">5–7 business days</div>
                </div>
              </Card>

              <Card title="Couriers">
                <ul className="text-sm space-y-2.5">
                  <li className="flex items-center justify-between">
                    <span>GIG Logistics</span>
                    <Badge tone="success">Primary</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Sendbox</span>
                    <Badge>Backup</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>DHL (international)</span>
                    <Badge tone="neutral">Inactive</Badge>
                  </li>
                </ul>
              </Card>
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
