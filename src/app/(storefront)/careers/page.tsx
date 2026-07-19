import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";
import { getCareersContent } from "@/lib/data/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Careers",
  description: `Join ${SITE.legalName}. Open roles in operations, engineering, and maker partnerships.`,
  alternates: { canonical: "/careers" },
};

export default async function CareersPage() {
  const c = await getCareersContent();
  return (
    <>
      <ContentPageHeader
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        description={c.hero.description}
        breadcrumb={[{ label: "Careers" }]}
      />

      <div className="mx-auto max-w-5xl px-4 lg:px-6 py-10 lg:py-16">
        {/* Values */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-6">
          {c.valuesHeading}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 lg:gap-6 mb-12 lg:mb-16">
          {c.values.map((v) => (
            <div key={v.title} className="rounded-lg border border-border bg-surface p-6">
              <h3 className="font-display text-lg font-semibold tracking-tight mb-2">{v.title}</h3>
              <p className="text-sm text-fg-muted leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>

        {/* Open roles */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-2">
          {c.rolesHeading}
        </h2>
        <p className="text-sm text-fg-muted mb-6">
          {c.roles.length} {c.roles.length === 1 ? "position" : "positions"} · Updated {c.rolesUpdated}
        </p>
        <div className="flex flex-col gap-3 mb-12 lg:mb-16">
          {c.roles.map((r) => (
            <article
              key={r.title}
              className="rounded-lg border border-border bg-surface p-6 lg:p-7 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand-primary mb-2">
                  {r.team}
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight mb-2">{r.title}</h3>
                <p className="text-sm text-fg-muted leading-relaxed mb-3">{r.body}</p>
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
            {c.speculative.title}
          </h2>
          <p className="text-sm lg:text-base opacity-90 mb-5 max-w-xl">{c.speculative.body}</p>
          <Link href={`mailto:${SITE.email}?subject=${encodeURIComponent("Speculative application")}`}>
            <Button className="bg-bg text-fg hover:bg-white/95">{c.speculative.buttonLabel}</Button>
          </Link>
        </div>
      </div>
    </>
  );
}
