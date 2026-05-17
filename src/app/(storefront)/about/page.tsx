import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.legalName} is a Nigerian e-commerce platform built to give small-batch makers a fair shot at the national market.`,
  alternates: { canonical: "/about" },
};

const PILLARS = [
  {
    title: "Makers first",
    body: "We pay our makers within seven days, every time. Margins are transparent — the maker chooses the wholesale price, we agree the retail markup together.",
  },
  {
    title: "No drop-shipping",
    body: "Every product on Avmall is in our warehouse before it goes on sale. If we say it ships in 24 hours, it ships in 24 hours.",
  },
  {
    title: "Pay the way you want",
    body: "Nuqood card, bank transfer, POS on delivery, cash on delivery, split payment for wholesale. The same prices apply across all of them.",
  },
  {
    title: "Honest returns",
    body: "14 days, no questions, free pickup in Lagos. The only items we can&apos;t take back are opened beauty and bespoke goods.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <ContentPageHeader
        eyebrow="About"
        title="Made in Nigeria, for the country"
        description={`${SITE.legalName} exists to give small-batch Nigerian makers a fair shot at the national market — without forcing them onto Instagram DMs or Bumpa stores that take half their revenue.`}
        breadcrumb={[{ label: "About" }]}
      />

      <div className="mx-auto max-w-5xl px-4 lg:px-6 py-10 lg:py-16">
        {/* Story */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-4">
          The short version
        </h2>
        <div className="text-sm lg:text-base text-fg-muted leading-relaxed space-y-4 mb-12 lg:mb-16">
          <p>
            Avmall started in 2024 with one Aba leather workshop and a spreadsheet of WhatsApp orders.
            The maker, Ade, was selling great work but losing hours every week to customers asking
            for prices, photos, delivery quotes, and tracking — the same questions, over and over.
          </p>
          <p>
            We built a website. Then a payment flow. Then a stock system that wouldn&apos;t oversell.
            Other makers started asking to be added. Today we work with 47 of them across beauty,
            home goods, fashion, and pantry — every product in our Ikoyi warehouse before it goes live.
          </p>
          <p>
            We&apos;re not a marketplace. There&apos;s a single curator on staff (hi, that&apos;s
            Tolu) who decides what goes on Avmall. We say no to far more makers than we say yes to —
            because saying yes means committing to ship their work flawlessly.
          </p>
        </div>

        {/* Pillars */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-6">
          What we stand for
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 lg:gap-6 mb-12 lg:mb-16">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-lg border border-border bg-surface p-6">
              <h3 className="font-display text-lg font-semibold tracking-tight mb-2">{p.title}</h3>
              <p className="text-sm text-fg-muted leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        {/* Maker story */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1f6f4a] to-[#0d4a2c] text-white p-10 lg:p-14 min-h-[320px] flex flex-col justify-between">
          <Image
            src="https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=1200&q=80&auto=format&fit=crop"
            alt="Avmall makers at work"
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover opacity-25 mix-blend-multiply"
          />
          <div className="relative max-w-lg">
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-85 mb-3">
              Become a maker
            </div>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold leading-tight mb-3">
              Sell your work without losing your weekends to DMs
            </h2>
            <p className="text-sm lg:text-base leading-relaxed opacity-90">
              If you&apos;re a small-batch maker in Nigeria and you think you&apos;d be a fit, we want
              to hear from you. We onboard 4–6 new makers a quarter.
            </p>
          </div>
          <Link href="/makers" className="relative self-start mt-6">
            <Button className="bg-white text-fg hover:bg-white/90">
              Apply to sell <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
