import {
  TrendingUp,
  Package,
  Users,
  Archive,
  Coins,
  MessageCircle,
  Clock,
  ShoppingBag,
  Truck,
  Sparkles,
  Download,
  Mail,
} from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

const REPORTS = [
  {
    icon: TrendingUp,
    name: "Revenue & sales",
    desc: "Daily, weekly, monthly revenue with channel breakdowns",
    badge: "Most viewed",
  },
  {
    icon: ShoppingBag,
    name: "Order performance",
    desc: "Conversion, AOV, fulfilment lead time, cancellation rate",
  },
  {
    icon: Package,
    name: "Inventory & stock",
    desc: "Stock-on-hand, low-stock alerts, reorder suggestions",
  },
  {
    icon: Coins,
    name: "Payments & reconciliation",
    desc: "Nuqood vs transfer vs POS · partial payments outstanding",
  },
  {
    icon: Archive,
    name: "Returns & refunds",
    desc: "Return rate by SKU, reason buckets, SLA compliance",
  },
  {
    icon: Users,
    name: "Customer cohorts",
    desc: "New vs repeat, RFM segments, churn signals",
  },
  {
    icon: Truck,
    name: "Shipping & courier",
    desc: "Delivery success rate by zone & courier · cost per order",
  },
  {
    icon: Sparkles,
    name: "AI agent activity",
    desc: "Sessions, conversions, handoff reasons, top intents",
  },
  {
    icon: MessageCircle,
    name: "WhatsApp channel",
    desc: "Inbound vs outbound, response time, lead-to-order",
  },
  {
    icon: Clock,
    name: "Staff activity",
    desc: "Orders per staff member, response time, audit trail summary",
  },
];

export default function AdminReportsPage() {
  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Reports" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Reports"
            subtitle="Heavy queries run as background jobs — you'll be emailed when complete"
            actions={
              <Button variant="secondary" size="sm">
                <Mail className="size-3.5" /> Email subscriptions
              </Button>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {REPORTS.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.name}
                  className="rounded-lg border border-border bg-surface p-5 hover:border-border-strong transition-colors cursor-pointer"
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
                  <p className="text-xs text-fg-muted leading-relaxed mb-4">{r.desc}</p>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary">
                      Open
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-4 rounded-md bg-info-bg border border-brand-primary/15 text-xs leading-relaxed">
            <span className="font-bold">Performance note:</span> CSV exports and inventory rollups
            are queued as background jobs (BullMQ) so the dashboard stays fast. You&apos;ll get an
            email + in-app notification when a report is ready.
          </div>
        </div>
      </div>
    </>
  );
}
