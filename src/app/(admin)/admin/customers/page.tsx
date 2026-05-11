import Link from "next/link";
import { Plus, Download, Search, ChevronDown, MoreHorizontal, ShieldAlert } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { CUSTOMERS } from "@/lib/admin-mock-data";

const FILTERS = ["Segment: Any", "Spend: Any", "Last order: Any", "Channel: Any"] as const;

export default function AdminCustomersListPage() {
  const blacklistedCount = CUSTOMERS.filter((c) => c.blacklisted).length;

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Customers" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Customers"
            subtitle={`1,240 customers · ${blacklistedCount} blacklisted`}
            actions={
              <>
                <Button variant="secondary" size="sm">
                  <Download className="size-3.5" /> Export
                </Button>
                <Button size="sm">
                  <Plus className="size-3.5" /> Add customer
                </Button>
              </>
            }
          />

          {/* Saved views */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {[
              { l: "All", n: 1240, active: true },
              { l: "VIP", n: 42 },
              { l: "Wholesale", n: 87 },
              { l: "Lagos", n: 412 },
              { l: "Inactive 90d+", n: 156 },
              { l: "Blacklisted", n: blacklistedCount },
            ].map((v) => (
              <button
                key={v.l}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                  "active" in v && v.active
                    ? "bg-info-bg border-brand-primary/30 text-brand-primary"
                    : "bg-surface border-border text-fg hover:border-border-strong"
                }`}
              >
                {v.l}
                <span className="opacity-60 tabular">{v.n}</span>
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="rounded-lg border border-border bg-surface p-3 mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 h-9 bg-surface-2 rounded-md text-sm text-fg-muted flex-1 min-w-[200px]">
              <Search className="size-4" />
              <span>Name, phone, email…</span>
            </div>
            {FILTERS.map((f) => (
              <button
                key={f}
                className="inline-flex items-center gap-1 px-3 h-9 bg-surface border border-border-strong rounded-md text-xs font-semibold hover:bg-surface-2"
              >
                {f} <ChevronDown className="size-3" />
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <th className="px-3.5 py-2.5 w-8">
                      <input type="checkbox" className="accent-brand-primary" />
                    </th>
                    <th className="text-left px-3.5 py-2.5">Customer</th>
                    <th className="text-left px-3.5 py-2.5">Segments</th>
                    <th className="text-right px-3.5 py-2.5">Orders</th>
                    <th className="text-right px-3.5 py-2.5">Lifetime spend</th>
                    <th className="text-left px-3.5 py-2.5">Last order</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {CUSTOMERS.map((c) => (
                    <tr
                      key={c.id}
                      className={`border-t border-border hover:bg-surface-2 ${c.blacklisted ? "bg-danger-bg/40" : ""}`}
                    >
                      <td className="px-3.5 py-3">
                        <input type="checkbox" className="accent-brand-primary" />
                      </td>
                      <td className="px-3.5 py-3">
                        <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-2.5">
                          <div className="size-9 rounded-full bg-gradient-to-br from-brand-primary to-[hsl(262_60%_48%)] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {c.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold inline-flex items-center gap-1.5">
                              {c.name}
                              {c.blacklisted && (
                                <ShieldAlert
                                  className="size-3.5 text-danger"
                                  aria-label="Blacklisted"
                                />
                              )}
                            </div>
                            <div className="text-[11px] text-fg-muted font-mono tabular">
                              {c.phone}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {c.segments.map((s) => (
                            <Badge key={s} tone={s === "VIP" ? "brand" : "neutral"}>
                              {s}
                            </Badge>
                          ))}
                          {c.blacklisted && <Badge tone="danger">Blacklisted</Badge>}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-right tabular font-semibold">{c.orders}</td>
                      <td className="px-3.5 py-3 text-right">
                        <Money kobo={c.lifetimeKobo} className="font-bold" />
                      </td>
                      <td className="px-3.5 py-3 text-xs text-fg-muted">{c.lastOrder}</td>
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
          </div>
        </div>
      </div>
    </>
  );
}
