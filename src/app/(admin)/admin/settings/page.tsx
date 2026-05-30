import { Truck, Shield, Sparkles, User, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";

/**
 * Settings is currently a launcher for the screens that already exist.
 * Placeholder cards (Business profile, Domains, Payments, Tax, Email
 * Templates, Webhooks, API keys, Data export) lived here before but they
 * pointed at href="#" — kept honest by removing until the relevant feature
 * lands.
 */
const SECTIONS = [
  {
    title: "Shipping",
    items: [
      {
        icon: Truck,
        label: "Shipping zones",
        desc: "Per-state base rates, free-shipping thresholds, fallbacks",
        href: "/admin/shipping",
      },
    ],
  },
  {
    title: "Team",
    items: [
      {
        icon: Shield,
        label: "Staff & roles",
        desc: "Invite staff, change roles, disable users",
        href: "/admin/staff",
      },
      {
        icon: User,
        label: "Your profile",
        desc: "Display name, change password",
        href: "/admin/profile",
      },
    ],
  },
  {
    title: "AI agent",
    items: [
      {
        icon: Sparkles,
        label: "AI agent",
        desc: "Conversation handoffs, negotiation rules",
        href: "/admin/ai",
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
          <PageHeader
            title="Settings"
            subtitle="Most configuration lives inside the relevant area — these are the launchers"
          />

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
                          <div className="text-xs text-fg-muted mt-0.5">
                            {item.desc}
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-fg-muted" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 p-5 rounded-lg border border-dashed border-border bg-surface-2 text-sm text-fg-muted leading-relaxed max-w-3xl">
            <div className="font-semibold text-fg mb-1.5">More settings coming.</div>
            Business profile, tax, payment provider config, email templates, and
            data export will appear here as each feature ships. Nuqood keys live in
            Vercel environment variables today.
          </div>
        </div>
      </div>
    </>
  );
}
