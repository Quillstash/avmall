import Link from "next/link";
import {
  TrendingUp,
  Package,
  Archive,
  Download,
  ArrowRight,
} from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { SummaryEmailTester } from "@/components/admin/summary-email-tester";

/**
 * Reports list. Trimmed to the three reports that are actually achievable
 * against the current DB (orders, products + cost data, returns). The other
 * placeholder cards have been removed — better empty than wishful.
 */
const REPORTS = [
  {
    icon: TrendingUp,
    name: "Revenue & sales",
    desc:
      "Daily, weekly and monthly revenue with channel and payment-method breakdowns. Drill into individual orders.",
    href: "/admin/reports/revenue",
    badge: "Most viewed",
  },
  {
    icon: Package,
    name: "Inventory & profit",
    desc:
      "Stock-on-hand, low-stock alerts, sell-through, and inventory profit margin (uses the cost prices set on each product).",
    href: "/admin/reports/inventory",
  },
  {
    icon: Archive,
    name: "Returns & refunds",
    desc:
      "Return rate by SKU, reason buckets, restock vs write-off, and the 14-day SLA compliance summary.",
    href: "/admin/reports/returns",
  },
];

export default function AdminReportsPage() {
  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Reports" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1100px] mx-auto">
          <PageHeader
            title="Reports"
            subtitle="A short list to start — we'll add more once these are live and used"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {REPORTS.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.name}
                  className="rounded-lg border border-border bg-surface p-5 flex flex-col"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="size-10 rounded-md bg-info-bg text-brand-primary flex items-center justify-center flex-shrink-0">
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{r.name}</div>
                      {r.badge && (
                        <div className="text-[10px] font-bold uppercase tracking-wider text-brand-primary mt-0.5">
                          {r.badge}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-fg-muted leading-relaxed mb-4 flex-1">
                    {r.desc}
                  </p>
                  <div className="flex gap-1.5">
                    <Link href={r.href}>
                      <Button size="sm" variant="secondary">
                        Open <ArrowRight className="size-3.5" />
                      </Button>
                    </Link>
                    <Button size="sm" variant="ghost" disabled>
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <SummaryEmailTester />
          </div>

          <div className="mt-8 p-4 rounded-md bg-info-bg border border-brand-primary/15 text-xs leading-relaxed">
            <span className="font-bold">Coming with Phase 5:</span> CSV exports run as
            background jobs so the dashboard stays fast — you&apos;ll get an email + in-app
            notification when a report is ready.
          </div>
        </div>
      </div>
    </>
  );
}
