import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";
import { getAboutContent } from "@/lib/data/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.legalName} is a Nigerian e-commerce platform built to give small-batch makers a fair shot at the national market.`,
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const c = await getAboutContent();
  return (
    <>
      <ContentPageHeader
        eyebrow={c.hero.eyebrow}
        title={c.hero.title}
        description={c.hero.description}
        breadcrumb={[{ label: "About" }]}
      />

      <div className="mx-auto max-w-5xl px-4 lg:px-6 py-10 lg:py-16">
        {/* Story */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-4">
          {c.storyHeading}
        </h2>
        <div className="text-sm lg:text-base text-fg-muted leading-relaxed space-y-4 mb-12 lg:mb-16">
          {c.storyParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {/* Pillars */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-6">
          {c.pillarsHeading}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 lg:gap-6 mb-12 lg:mb-16">
          {c.pillars.map((p) => (
            <div key={p.title} className="rounded-lg border border-border bg-surface p-6">
              <h3 className="font-display text-lg font-semibold tracking-tight mb-2">{p.title}</h3>
              <p className="text-sm text-fg-muted leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        {/* Maker story CTA */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1f6f4a] to-[#0d4a2c] text-white p-10 lg:p-14 min-h-[320px] flex flex-col justify-between">
          {c.cta.imageUrl && (
            <Image
              src={c.cta.imageUrl}
              alt="Avmall makers at work"
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover opacity-25 mix-blend-multiply"
            />
          )}
          <div className="relative max-w-lg">
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-85 mb-3">
              {c.cta.eyebrow}
            </div>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold leading-tight mb-3">
              {c.cta.title}
            </h2>
            <p className="text-sm lg:text-base leading-relaxed opacity-90">{c.cta.body}</p>
          </div>
          <Link href={c.cta.buttonHref} className="relative self-start mt-6">
            <Button className="bg-white text-fg hover:bg-white/90">
              {c.cta.buttonLabel} <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
