import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Careers",
  description: `Join ${SITE.legalName}. Open roles in operations, engineering, and maker partnerships.`,
  alternates: { canonical: "/careers" },
};

const ROLES = [
  {
    title: "Warehouse Operations Lead",
    team: "Operations",
    location: "Zaria, Kaduna",
    type: "Full-time · On-site",
    body: "Own the warehouse end-to-end: picking, packing, returns, and the team of 4 dispatch riders. Inventory accuracy is the metric.",
  },
  {
    title: "Senior Backend Engineer",
    team: "Engineering",
    location: "Zaria / Remote",
    type: "Full-time · Hybrid",
    body: "Next.js + PostgreSQL + Prisma. You&rsquo;ll own the order pipeline — checkout, payments, returns — and the AI agent tool API.",
  },
  {
    title: "Maker Partnerships Manager",
    team: "Partnerships",
    location: "Zaria, Kaduna",
    type: "Full-time · On-site",
    body: "Source, evaluate, and onboard new makers. Travel within Nigeria once a month — workshop visits, photoshoots, contracting.",
  },
  {
    title: "Customer Care Specialist (WhatsApp)",
    team: "Support",
    location: "Zaria",
    type: "Full-time · Shift",
    body: "Front-line for WhatsApp tickets. Quick, kind, accurate — and unafraid to escalate when a maker or a customer needs more than a quick reply.",
  },
] as const;

const VALUES = [
  {
    title: "Ship the thing",
    body: "Move quickly, but never at the expense of the maker or the customer.",
  },
  {
    title: "Honesty over polish",
    body: "If the photo doesn&rsquo;t match the product, fix the photo. If the timeline slips, tell the customer.",
  },
  {
    title: "Compound the warehouse",
    body: "Every process improvement we ship lives forever. Documentation is a feature.",
  },
  {
    title: "Hire for trust",
    body: "Senior or junior, we ship things that affect real customers and real makers from day one.",
  },
] as const;

export default function CareersPage() {
  return (
    <>
      <ContentPageHeader
        eyebrow="Join us"
        title="Build the Nigerian retail platform"
        description="We&rsquo;re a small team in Zaria shipping a serious amount of software, warehouse ops, and maker partnerships. Open roles below."
        breadcrumb={[{ label: "Careers" }]}
      />

      <div className="mx-auto max-w-5xl px-4 lg:px-6 py-10 lg:py-16">
        {/* Values */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-6">
          How we work
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 lg:gap-6 mb-12 lg:mb-16">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-lg border border-border bg-surface p-6">
              <h3 className="font-display text-lg font-semibold tracking-tight mb-2">{v.title}</h3>
              <p
                className="text-sm text-fg-muted leading-relaxed"
                dangerouslySetInnerHTML={{ __html: v.body }}
              />
            </div>
          ))}
        </div>

        {/* Open roles */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-2">
          Open roles
        </h2>
        <p className="text-sm text-fg-muted mb-6">
          {ROLES.length} positions · Updated 1 May 2026
        </p>
        <div className="flex flex-col gap-3 mb-12 lg:mb-16">
          {ROLES.map((r) => (
            <article
              key={r.title}
              className="rounded-lg border border-border bg-surface p-6 lg:p-7 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-primary mb-2">
                  {r.team}
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight mb-2">{r.title}</h3>
                <p
                  className="text-sm text-fg-muted leading-relaxed mb-3"
                  dangerouslySetInnerHTML={{ __html: r.body }}
                />
                <div className="flex flex-wrap gap-3 text-xs text-fg-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {r.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" /> {r.type}
                  </span>
                </div>
              </div>
              <Link
                href={`mailto:${SITE.email}?subject=${encodeURIComponent(
                  `Application: ${r.title}`,
                )}`}
              >
                <Button>
                  Apply <ArrowRight className="size-4" />
                </Button>
              </Link>
            </article>
          ))}
        </div>

        {/* Speculative */}
        <div className="rounded-xl bg-fg text-bg p-8 lg:p-10">
          <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-2">
            Don&apos;t see your role?
          </h2>
          <p className="text-sm lg:text-base opacity-90 mb-5 max-w-xl">
            If you think you&apos;d be exceptional here, tell us how. Speculative applications get
            read by our founders, every one of them.
          </p>
          <Link href={`mailto:${SITE.email}?subject=${encodeURIComponent("Speculative application")}`}>
            <Button className="bg-bg text-fg hover:bg-white/95">
              Email the founders
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
