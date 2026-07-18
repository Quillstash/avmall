import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MessageCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";
import { getStoreContact, storeWaLink } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Sell on Avmall — Nigerian makers",
  description: `Apply to sell your work on ${SITE.name}. Fast onboarding, 7-day payouts, no marketplace fees beyond the curator margin.`,
  alternates: { canonical: "/makers" },
};

const BENEFITS = [
  {
    title: "Paid in 7 days",
    body: "We hold stock and pay you on net-7 terms after the order ships. No three-month payment holds.",
  },
  {
    title: "Photography on us",
    body: "We bring your stock to our studio and shoot it for the site. Photos are yours to keep and reuse.",
  },
  {
    title: "Storage in our warehouse",
    body: "Zaria warehouse storage at no monthly fee. We pick, pack, and ship — you keep making.",
  },
  {
    title: "One curator margin",
    body: "30% blended margin (lower for higher volume). No listing fees, no platform fees, no surprise deductions.",
  },
  {
    title: "Cross-channel reach",
    body: "Customers find your work from the storefront, our WhatsApp AI agent, and our wholesale buyer network.",
  },
  {
    title: "You set the price",
    body: "We never undercut you. The price on Avmall is the price you and we agreed at onboarding.",
  },
] as const;

const STEPS = [
  "Send us a few photos and a description of your work on WhatsApp",
  "We&rsquo;ll set up a 30-min call within 3 working days",
  "If it&rsquo;s a fit, we onboard 4–6 new makers a quarter",
  "Photography, listing, and first stock delivery happens in week 2",
] as const;

export default async function MakersPage() {
  // Support/WhatsApp number is admin-editable at /admin/settings.
  const contact = await getStoreContact();
  const whatsappHref = storeWaLink(contact.whatsapp);
  return (
    <>
      <ContentPageHeader
        eyebrow="For makers"
        title="Sell your work on Avmall"
        description="If you make in small batches and want a national audience without losing your weekends to DMs — let&rsquo;s talk."
        breadcrumb={[{ label: "Makers" }]}
      />

      <div className="mx-auto max-w-5xl px-4 lg:px-6 py-10 lg:py-16">
        {/* CTA at top */}
        <div className="rounded-xl bg-fg text-bg p-8 lg:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-12 lg:mb-16">
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-75 mb-2">
              Currently onboarding
            </div>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold leading-tight">
              Q2 2026 maker cohort — 6 spots left
            </h2>
          </div>
          <Link href={whatsappHref} target="_blank" rel="noreferrer">
            <Button className="bg-bg text-fg hover:bg-white/95">
              <MessageCircle className="size-4" /> Open WhatsApp
            </Button>
          </Link>
        </div>

        {/* Benefits */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-6">
          What you get
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-12 lg:mb-16">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-lg border border-border bg-surface p-6">
              <CheckCircle2 className="size-5 text-brand-accent mb-3" />
              <h3 className="font-display text-lg font-semibold tracking-tight mb-2">{b.title}</h3>
              <p className="text-sm text-fg-muted leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-6">
          How onboarding works
        </h2>
        <ol className="space-y-4 mb-12 lg:mb-16">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-4">
              <div className="size-8 flex-shrink-0 rounded-full bg-brand-primary text-brand-primary-fg flex items-center justify-center font-bold text-sm">
                {i + 1}
              </div>
              <p
                className="text-sm lg:text-base text-fg-muted leading-relaxed pt-1"
                dangerouslySetInnerHTML={{ __html: step }}
              />
            </li>
          ))}
        </ol>

        {/* What we look for */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-6">
          What we look for
        </h2>
        <div className="rounded-lg border border-border bg-surface p-6 lg:p-8 mb-12 lg:mb-16">
          <ul className="space-y-3 text-sm lg:text-base text-fg-muted leading-relaxed list-disc pl-5">
            <li>You make your own work — we don&apos;t resell wholesale imports.</li>
            <li>Your batch size and stock are something you can commit to consistently.</li>
            <li>Pricing, ingredients, and process are transparent — we tell our customers everything.</li>
            <li>You&apos;re registered (CAC) or willing to register during onboarding. We help with this.</li>
          </ul>
        </div>

        <div className="text-center">
          <p className="text-sm text-fg-muted mb-4">Already convinced?</p>
          <Link href={whatsappHref} target="_blank" rel="noreferrer">
            <Button size="lg">
              Apply on WhatsApp <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
