import type { Metadata } from "next";
import Link from "next/link";
import { RefreshCcw, ShieldCheck, XCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Returns & refunds",
  description: `14-day no-questions returns at ${SITE.name}. Refunds to your original payment method within 7 working days.`,
  alternates: { canonical: "/returns" },
};

export default function ReturnsPage() {
  return (
    <>
      <ContentPageHeader
        eyebrow="Help"
        title="Returns & refunds"
        description="14 days, no questions, free pickup in Lagos. Here&rsquo;s exactly how it works."
        breadcrumb={[{ label: "Returns" }]}
      />

      <div className="mx-auto max-w-4xl px-4 lg:px-6 py-10 lg:py-16">
        {/* Highlights */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <Card icon={RefreshCcw} title="14 days" sub="From delivery date" />
          <Card icon={ShieldCheck} title="Free Lagos pickup" sub="Or drop at our flagship" />
          <Card icon={MessageCircle} title="Refund in 7 days" sub="To your original method" />
        </div>

        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-5">
          How it works
        </h2>
        <ol className="space-y-4 mb-10">
          {[
            "Open your order from /account/orders and tap 'Request return'. Pick the items and tell us briefly why.",
            "We confirm by WhatsApp within an hour during business hours. If your address is in Lagos we schedule a free pickup.",
            "We inspect the items in our warehouse — usually same-day after they arrive.",
            "Refund issued within 7 working days to your original payment method, or by bank transfer if you prefer.",
          ].map((step, i) => (
            <li key={i} className="flex gap-4">
              <div className="size-8 flex-shrink-0 rounded-full bg-brand-primary text-brand-primary-fg flex items-center justify-center font-bold text-sm">
                {i + 1}
              </div>
              <p className="text-sm lg:text-base text-fg-muted leading-relaxed pt-1">{step}</p>
            </li>
          ))}
        </ol>

        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-5">
          What we can take back
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <Panel
            tone="ok"
            title="Yes — refundable"
            items={[
              "Unopened, unused goods in original packaging",
              "Wrong item received",
              "Damaged in transit (photos required)",
              "Different from website description",
            ]}
          />
          <Panel
            tone="no"
            title="No — final sale"
            items={[
              "Opened beauty, food, and personal-care items",
              "Custom or bespoke orders",
              "Gift cards",
              "Anything returned outside the 14-day window",
            ]}
          />
        </div>

        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-5">
          Damaged or wrong item?
        </h2>
        <p className="text-sm lg:text-base text-fg-muted leading-relaxed mb-3">
          Take a clear photo of the damage or wrong item (including the box) and message us on
          WhatsApp within 48 hours of delivery. We escalate these and either refund or replace —
          your choice — at no extra cost.
        </p>

        <div className="rounded-lg bg-fg text-bg p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-10">
          <div className="flex-1">
            <div className="font-bold text-lg mb-1">Need a return now?</div>
            <p className="text-sm opacity-90">
              Sign in, find the order, and tap &ldquo;Request return&rdquo; — or message us directly.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/account/orders">
              <Button variant="secondary" className="bg-bg/10 text-bg border-white/20 hover:bg-bg/20">
                My orders
              </Button>
            </Link>
            <Link href={SITE.social.whatsapp} target="_blank" rel="noreferrer">
              <Button className="bg-bg text-fg hover:bg-white/95">WhatsApp</Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Card({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof RefreshCcw;
  title: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 flex items-start gap-3">
      <div className="size-10 rounded-md bg-info-bg text-brand-primary flex items-center justify-center flex-shrink-0">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="font-bold">{title}</div>
        <div className="text-xs text-fg-muted mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function Panel({
  tone,
  title,
  items,
}: {
  tone: "ok" | "no";
  title: string;
  items: string[];
}) {
  const Icon = tone === "ok" ? ShieldCheck : XCircle;
  return (
    <div
      className={`rounded-lg border p-5 ${
        tone === "ok"
          ? "border-brand-accent/20 bg-success-bg"
          : "border-danger/20 bg-danger-bg"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`size-4 ${tone === "ok" ? "text-brand-accent" : "text-danger"}`} />
        <div className="font-bold text-sm">{title}</div>
      </div>
      <ul className="space-y-1.5 text-sm text-fg-muted">
        {items.map((it) => (
          <li key={it}>• {it}</li>
        ))}
      </ul>
    </div>
  );
}
