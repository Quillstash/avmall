import type { Metadata } from "next";
import Link from "next/link";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms governing your use of ${SITE.name} — orders, payments, returns, and conduct.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <ContentPageHeader
        eyebrow="Legal"
        title="Terms of service"
        description="Last updated 1 May 2026. By using Avmall you agree to these terms."
        breadcrumb={[{ label: "Terms" }]}
      />
      <div className="mx-auto max-w-3xl px-4 lg:px-6 py-10 lg:py-16 prose-content">
        <Section title="1. Who we are">
          <p>
            Avmall is operated by {SITE.legalName} Ltd (RC 1842901), a company registered in Nigeria with
            offices at {SITE.address.street}, {SITE.address.city}, {SITE.address.state}. References
            to &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;Avmall&rdquo; mean {SITE.legalName} Ltd.
          </p>
        </Section>

        <Section title="2. Orders & pricing">
          <p>
            Prices are in Nigerian Naira and include VAT where applicable. We confirm orders by SMS,
            WhatsApp, or email. Until you receive that confirmation, no contract is in place and we
            may decline any order — typically because of stock, suspected fraud, or pricing errors.
          </p>
          <p>
            If a pricing error is obvious (for example a ₦1 product), we will contact you before
            charging and offer either the correct price or a full refund of any pre-payment.
          </p>
        </Section>

        <Section title="3. Payment">
          <p>
            We accept card payments via Nuqood, direct bank transfers, POS on delivery (Zaria only),
            and cash on delivery (Zaria only). For online card payments the charge is captured at
            checkout. For bank transfers your order moves to &ldquo;processing&rdquo; only once funds
            clear in our account.
          </p>
        </Section>

        <Section title="4. Delivery">
          <p>
            We aim to deliver within 24 hours in Zaria and 2–5 working days elsewhere in Nigeria.
            Delivery windows are estimates, not guarantees. Risk of loss transfers to you on delivery.
            For more detail see our <Link href="/shipping" className="text-brand-primary underline">shipping policy</Link>.
          </p>
        </Section>

        <Section title="5. Returns & refunds">
          <p>
            You can return most items within 14 days of delivery. Bespoke, perishable, and personal-care
            items are non-returnable once opened. Refunds are issued to the original payment method
            within 7 working days of us receiving the return. Full details on the <Link href="/returns" className="text-brand-primary underline">returns page</Link>.
          </p>
        </Section>

        <Section title="6. Acceptable use">
          <p>
            You agree not to use Avmall to commit fraud, scrape data at volume, attempt to bypass
            stock or pricing controls, or harass our staff or makers. Repeated chargebacks, returns
            abuse, or fraudulent claims may result in your account being blacklisted.
          </p>
        </Section>

        <Section title="7. Liability">
          <p>
            Our liability for any single order is capped at the amount you paid for that order.
            We are not liable for indirect or consequential losses (lost profit, lost data, etc.)
            to the extent permitted by Nigerian law.
          </p>
        </Section>

        <Section title="8. Changes">
          <p>
            We may update these terms. The version at the top of this page is always current. Material
            changes are emailed to customers with an active account.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            Questions about these terms: <a href={`mailto:${SITE.supportEmail}`} className="text-brand-primary underline">{SITE.supportEmail}</a>.
          </p>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl lg:text-2xl font-semibold tracking-tight mb-3">
        {title}
      </h2>
      <div className="text-sm lg:text-base text-fg-muted leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
