import {
  Store,
  CreditCard,
  Truck,
  Bell,
  Webhook,
  Receipt,
  Globe,
  KeyRound,
  Database,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";

const SECTIONS = [
  {
    title: "Store",
    items: [
      { icon: Store, label: "Business profile", desc: "Name, RC number, contact, social", href: "#" },
      { icon: Globe, label: "Domains & SEO", desc: "Storefront URL, meta tags, sitemap", href: "#" },
    ],
  },
  {
    title: "Commerce",
    items: [
      {
        icon: CreditCard,
        label: "Payments",
        desc: "Nuqood keys, bank account, POS terminals",
        href: "#",
      },
      {
        icon: Truck,
        label: "Shipping & couriers",
        desc: "Zones, fallbacks, courier integrations",
        href: "/admin/shipping",
      },
      {
        icon: Receipt,
        label: "Tax",
        desc: "VAT settings, receipts, invoice templates",
        href: "#",
      },
    ],
  },
  {
    title: "Notifications",
    items: [
      {
        icon: Bell,
        label: "Email & SMS templates",
        desc: "Order confirmation, shipped, OTP, abandoned cart",
        href: "#",
      },
      {
        icon: Webhook,
        label: "Webhooks",
        desc: "Outbound events to your CRM / ops tooling",
        href: "#",
      },
    ],
  },
  {
    title: "Advanced",
    items: [
      {
        icon: KeyRound,
        label: "API keys & tokens",
        desc: "AI agent JWTs, integration tokens (rotatable)",
        href: "#",
      },
      {
        icon: Database,
        label: "Data export & backup",
        desc: "CSV/JSON exports, Bumpa migration tools",
        href: "#",
      },
    ],
  },
];

export default function AdminSettingsPage() {
  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Settings" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader title="Settings" subtitle="Store, commerce, notifications, and integrations" />

          <div className="grid lg:grid-cols-2 gap-8">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-fg-muted mb-3">
                  {section.title}
                </h2>
                <div className="flex flex-col gap-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center gap-3 p-4 rounded-lg border border-border bg-surface hover:border-border-strong"
                      >
                        <div className="size-10 rounded-md bg-info-bg text-brand-primary flex items-center justify-center flex-shrink-0">
                          <Icon className="size-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm">{item.label}</div>
                          <div className="text-xs text-fg-muted mt-0.5">{item.desc}</div>
                        </div>
                        <ChevronRight className="size-4 text-fg-muted" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
