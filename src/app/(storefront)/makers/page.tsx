import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MessageCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";
import { getStoreContact, storeWaLink } from "@/lib/data/settings";
import { getMakersContent } from "@/lib/data/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sell on Avmall — Nigerian makers",
  description: `Apply to sell your work on ${SITE.name}. Fast onboarding, 7-day payouts, no marketplace fees beyond the curator margin.`,
  alternates: { canonical: "/makers" },
};

export default async function MakersPage() {
  // Support/WhatsApp number is admin-editable at /admin/settings; page copy at
  // /admin/content.
  const [contact, c] = await Promise.all([getStoreContact(), getMakersContent()]);
  const whatsappHref = storeWaLink(contact.whatsapp);
  return (
    <>
      <ContentPageHeader
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        description={c.hero.description}
        breadcrumb={[{ label: "Makers" }]}
      />

      <div className="mx-auto max-w-5xl px-4 lg:px-6 py-10 lg:py-16">
        {/* CTA at top */}
        <div className="rounded-xl bg-fg text-bg p-8 lg:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-12 lg:mb-16">
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-75 mb-2">
              {c.onboardingCta.eyebrow}
            </div>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold leading-tight">
              {c.onboardingCta.title}
            </h2>
          </div>
          <Link href={whatsappHref} target="_blank" rel="noreferrer">
            <Button className="bg-bg text-fg hover:bg-white/95">
              <MessageCircle className="size-4" /> {c.onboardingCta.buttonLabel}
            </Button>
          </Link>
        </div>

        {/* Benefits */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-6">
          {c.benefitsHeading}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-12 lg:mb-16">
          {c.benefits.map((b) => (
            <div key={b.title} className="rounded-lg border border-border bg-surface p-6">
              <CheckCircle2 className="size-5 text-brand-accent mb-3" />
              <h3 className="font-display text-lg font-semibold tracking-tight mb-2">{b.title}</h3>
              <p className="text-sm text-fg-muted leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-6">
          {c.stepsHeading}
        </h2>
        <ol className="space-y-4 mb-12 lg:mb-16">
          {c.steps.map((step, i) => (
            <li key={i} className="flex gap-4">
              <div className="size-8 flex-shrink-0 rounded-full bg-brand-primary text-brand-primary-fg flex items-center justify-center font-bold text-sm">
                {i + 1}
              </div>
              <p className="text-sm lg:text-base text-fg-muted leading-relaxed pt-1">{step}</p>
            </li>
          ))}
        </ol>

        {/* What we look for */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-6">
          {c.lookForHeading}
        </h2>
        <div className="rounded-lg border border-border bg-surface p-6 lg:p-8 mb-12 lg:mb-16">
          <ul className="space-y-3 text-sm lg:text-base text-fg-muted leading-relaxed list-disc pl-5">
            {c.lookFor.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="text-center">
          <p className="text-sm text-fg-muted mb-4">{c.finalCta.intro}</p>
          <Link href={whatsappHref} target="_blank" rel="noreferrer">
            <Button size="lg">
              {c.finalCta.buttonLabel} <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
