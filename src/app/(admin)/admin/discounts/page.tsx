import { Plus, Lock, MoreHorizontal, Flag, Sparkles, Tag } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DISCOUNTS, type DiscountKind } from "@/lib/admin-mock-data";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<DiscountKind, typeof Flag> = {
  coupon: Tag,
  automatic: Sparkles,
  bulk: Flag,
};

const KIND_LABEL: Record<DiscountKind, string> = {
  coupon: "Coupon",
  automatic: "Automatic",
  bulk: "Bulk tier",
};

export default function AdminDiscountsPage() {
  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Discounts" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Discounts"
            subtitle={`${DISCOUNTS.length} discounts · ${DISCOUNTS.filter((d) => d.active).length} active`}
            actions={
              <Button size="sm">
                <Plus className="size-3.5" /> New discount
              </Button>
            }
          />

          {/* Notice about locked-after-redemptions */}
          <div className="mb-5 p-3.5 rounded-md bg-info-bg border border-brand-primary/20 text-xs leading-relaxed flex items-start gap-2.5">
            <Lock className="size-4 text-brand-primary flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Edits restricted after redemptions.</span> Once a
              coupon has been used, its value and scope are locked. You can still toggle the active
              flag, change the usage limit, and update validity dates.
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <th className="text-left px-3.5 py-2.5">Discount</th>
                    <th className="text-left px-3.5 py-2.5">Code</th>
                    <th className="text-left px-3.5 py-2.5">Value</th>
                    <th className="text-left px-3.5 py-2.5">Scope</th>
                    <th className="text-right px-3.5 py-2.5">Usage</th>
                    <th className="text-left px-3.5 py-2.5">Validity</th>
                    <th className="text-left px-3.5 py-2.5">Status</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {DISCOUNTS.map((d) => {
                    const Icon = KIND_ICON[d.kind];
                    return (
                      <tr key={d.id} className="border-t border-border hover:bg-surface-2">
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-md bg-info-bg text-brand-primary flex items-center justify-center flex-shrink-0">
                              <Icon className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{d.name}</div>
                              <div className="text-[11px] text-fg-muted">
                                {KIND_LABEL[d.kind]}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3.5 py-3">
                          {d.code ? (
                            <code className="font-mono text-xs font-bold bg-surface-2 px-2 py-1 rounded tabular">
                              {d.code}
                            </code>
                          ) : (
                            <span className="text-fg-subtle text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 font-semibold tabular">
                          <div className="inline-flex items-center gap-1.5">
                            {d.valueLabel}
                            {d.locked && (
                              <span
                                className="inline-flex items-center text-fg-subtle"
                                title="Value locked — discount has been redeemed"
                              >
                                <Lock className="size-3" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3.5 py-3 text-xs text-fg-muted">
                          <div className="inline-flex items-center gap-1.5">
                            {d.scope}
                            {d.locked && <Lock className="size-3 text-fg-subtle" />}
                          </div>
                        </td>
                        <td className="px-3.5 py-3 text-right tabular">
                          {d.usage.toLocaleString()}
                          {d.usageLimit != null && (
                            <span className="text-fg-muted text-[11px]">
                              /{d.usageLimit.toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-xs text-fg-muted">{d.validity}</td>
                        <td className="px-3.5 py-3">
                          <Badge tone={d.active ? "success" : "neutral"}>
                            {d.active ? "Active" : "Inactive"}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
