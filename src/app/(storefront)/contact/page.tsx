import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Mail, MapPin, Phone, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";
import { getStoreContact, storeWaLink } from "@/lib/data/settings";
import { formatNigerianPhone } from "@/lib/phone";
import { mailtoLink } from "@/lib/contact-links";

export const metadata: Metadata = {
  title: "Contact us",
  description: `Get in touch with the ${SITE.name} team — WhatsApp, email, phone, or visit our Zaria flagship.`,
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  // Support/WhatsApp number + contact details are admin-editable at /admin/settings.
  const contact = await getStoreContact();
  const whatsappHref = storeWaLink(contact.whatsapp);
  return (
    <>
      <ContentPageHeader
        eyebrow="Get in touch"
        title="We&rsquo;re here, in real life"
        description="WhatsApp is fastest. Email is fine. Walk in if you&rsquo;re passing through Zaria."
        breadcrumb={[{ label: "Contact" }]}
      />

      <div className="mx-auto max-w-5xl px-4 lg:px-6 py-10 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6 mb-10">
          <Card
            icon={MessageCircle}
            label="Best for orders, questions, returns"
            title="WhatsApp"
            primary={formatNigerianPhone(contact.whatsapp)}
            href={whatsappHref}
            cta="Open WhatsApp"
            featured
          />
          <Card
            icon={Mail}
            label="Best for receipts, formal requests, partnerships"
            title="Email"
            primary={contact.email}
            href={mailtoLink(contact.email)}
            cta="Compose email"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <Info icon={Phone} title="Phone" body={contact.phone} />
          <Info icon={MapPin} title="Address" body={contact.address} />
          <Info icon={Clock} title="Hours" body="Mon–Sat 10am–7pm" />
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 lg:p-8 mb-10">
          <h2 className="font-display text-xl lg:text-2xl font-semibold tracking-tight mb-2">
            Wholesale & bulk
          </h2>
          <p className="text-sm lg:text-base text-fg-muted leading-relaxed mb-4">
            Buying for your shop, hotel, hamper business, or corporate gifting? You&apos;ll get tiered
            pricing, a dedicated account manager, split-payment terms, and scheduled deliveries.
            Open a wholesale chat on WhatsApp and we&apos;ll take it from there.
          </p>
          <Link
            href={storeWaLink(contact.whatsapp, "Hi, I'm interested in wholesale pricing.")}
            target="_blank"
            rel="noreferrer"
          >
            <Button>
              <MessageCircle className="size-4" /> Open a wholesale chat
            </Button>
          </Link>
        </div>

        <div className="rounded-lg bg-fg text-bg p-8">
          <h2 className="font-display text-xl lg:text-2xl font-semibold tracking-tight mb-2">
            Press & partnerships
          </h2>
          <p className="text-sm opacity-90 mb-4">
            For interview requests, maker partnerships, or media kits, email{" "}
            <a href={`mailto:${SITE.email}`} className="underline">
              {SITE.email}
            </a>
            . We respond within two working days.
          </p>
        </div>
      </div>
    </>
  );
}

function Card({
  icon: Icon,
  label,
  title,
  primary,
  href,
  cta,
  featured,
}: {
  icon: typeof MessageCircle;
  label: string;
  title: string;
  primary: string;
  href: string;
  cta: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-6 lg:p-8 ${
        featured
          ? "border-brand-accent/30 bg-success-bg"
          : "border-border bg-surface"
      }`}
    >
      <div className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-3">
        {label}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`size-10 rounded-md flex items-center justify-center flex-shrink-0 ${
            featured
              ? "bg-brand-accent text-white"
              : "bg-info-bg text-brand-primary"
          }`}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <div className="font-display text-xl font-semibold tracking-tight">{title}</div>
          <div className="text-sm text-fg-muted tabular">{primary}</div>
        </div>
      </div>
      <Link href={href} target="_blank" rel="noreferrer">
        <Button variant={featured ? "primary" : "secondary"}>{cta}</Button>
      </Link>
    </div>
  );
}

function Info({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Phone;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="size-4 text-fg-muted" />
        <div className="text-[11px] font-bold uppercase tracking-wider">{title}</div>
      </div>
      <div className="text-sm text-fg-muted">{body}</div>
    </div>
  );
}
