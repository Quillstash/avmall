import type { Metadata } from "next";
import Link from "next/link";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: `Answers to common questions about ordering, payment, delivery, and returns at ${SITE.name}.`,
  alternates: { canonical: "/faq" },
};

const SECTIONS = [
  {
    heading: "Ordering",
    items: [
      {
        q: "Do I need an account to order?",
        a: "No. Checkout works as a guest — we tie the order to your phone number. Creating an account is only useful if you want to see order history in one place or store an address.",
      },
      {
        q: "Can I change or cancel an order after placing it?",
        a: "While the order status is 'pending' or 'confirmed' — yes, message us on WhatsApp. Once it moves to 'processing' we have already started picking it. After 'shipped' you'd need to refuse the delivery and we issue a refund.",
      },
      {
        q: "Why was my payment declined?",
        a: "Usually a bank-side issue: insufficient funds, daily card limit hit, or the card is not enabled for online purchases. Try a bank transfer instead — instructions are shown at checkout.",
      },
      {
        q: "Are prices in Naira?",
        a: "Yes. Every price on Avmall is in Nigerian Naira (₦) and includes VAT where applicable.",
      },
    ],
  },
  {
    heading: "Payment",
    items: [
      {
        q: "What payment methods do you accept?",
        a: "Card payments (Visa, Mastercard, Verve) via Nuqood, direct bank transfer, POS on delivery (Zaria only), and cash on delivery (Zaria only).",
      },
      {
        q: "Is paying online safe?",
        a: "Card details never touch our servers. We use Nuqood, a PCI-DSS Level 1 certified processor. The connection is HTTPS-encrypted end to end.",
      },
      {
        q: "Can I split a large payment?",
        a: "Yes — message us on WhatsApp before placing the order and we will set up a split payment plan. We handle these case-by-case for orders over ₦200,000.",
      },
    ],
  },
  {
    heading: "Delivery",
    items: [
      {
        q: "How quickly will I get my order?",
        a: "Same-day in Zaria if you order before 1pm. 24 hours for other Zaria zones. 2–5 working days nationwide. Detail on the shipping page.",
      },
      {
        q: "Can I track my order?",
        a: "Yes. We send tracking via SMS and WhatsApp, and your order page shows the latest status. You can also use the /track-order page with your order number and phone.",
      },
      {
        q: "What if I'm not home for delivery?",
        a: "Our courier will try twice more on the same day, then schedule a redelivery the next working day. After three failed attempts we hold for pickup or refund — at your choice.",
      },
    ],
  },
  {
    heading: "Returns & quality",
    items: [
      {
        q: "What's your return policy?",
        a: "14 days, no questions, free pickup in Zaria. Some items are final sale (opened beauty, perishables, bespoke). Full detail on the returns page.",
      },
      {
        q: "What if my item is damaged?",
        a: "Photograph the damage (box included) and message us on WhatsApp within 48 hours. We escalate these and either refund or replace, your choice, at no extra cost.",
      },
      {
        q: "Do you check items before shipping?",
        a: "Every order is inspected and photographed before it leaves the warehouse — we share the photo on WhatsApp if you'd like a record.",
      },
    ],
  },
  {
    heading: "Account & support",
    items: [
      {
        q: "How do I reset my password?",
        a: "Avmall accounts use phone or email OTP — no passwords. Just enter your phone number or email at sign-in and we send a 6-digit code.",
      },
      {
        q: "Why is my account blacklisted?",
        a: "Accounts are blacklisted for repeated fraudulent chargebacks, returns abuse, or staff harassment. If you think this happened in error, email " + SITE.supportEmail + " with your order details.",
      },
      {
        q: "Where can I reach a human?",
        a: "WhatsApp 8am–9pm (link in the nav and footer), or email " + SITE.supportEmail + ". Response time is usually under an hour on WhatsApp during business hours.",
      },
    ],
  },
] as const;

export default function FAQPage() {
  return (
    <>
      <ContentPageHeader
        eyebrow="Help"
        title="Frequently asked"
        description="Quick answers to the questions we hear most often."
        breadcrumb={[{ label: "FAQ" }]}
      />

      <div className="mx-auto max-w-3xl px-4 lg:px-6 py-10 lg:py-16">
        {SECTIONS.map((section) => (
          <section key={section.heading} className="mb-10">
            <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-5">
              {section.heading}
            </h2>
            <div className="rounded-lg border border-border bg-surface divide-y divide-border">
              {section.items.map((it) => (
                <details key={it.q} className="group">
                  <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer text-sm lg:text-base font-semibold list-none">
                    <span>{it.q}</span>
                    <span className="size-6 rounded-full border border-border flex items-center justify-center text-fg-muted flex-shrink-0 group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <div className="px-5 pb-5 text-sm text-fg-muted leading-relaxed">{it.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-lg bg-surface-2 p-6 text-center">
          <p className="text-sm text-fg-muted">
            Didn&apos;t find what you needed?{" "}
            <Link href="/contact" className="text-brand-primary underline font-semibold">
              Get in touch
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
