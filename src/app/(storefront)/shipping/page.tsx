import type { Metadata } from "next";
import Link from "next/link";
import { Truck, MapPin, Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";
import { getStoreContact, storeWaLink } from "@/lib/data/settings";
import { listShippingZones, getFallbackShipping } from "@/lib/data/shipping";
import { formatMoney } from "@/lib/money";

// Rates are admin-managed, so never statically cache this page.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping",
  description: `${SITE.name} delivery zones, rates, and timelines across Nigeria.`,
  alternates: { canonical: "/shipping" },
};

const ZONES = [
  {
    zone: "Zaria & Sabon Gari (Samaru, Tudun Wada, City)",
    rate: "₦1,500",
    eta: "Same-day if ordered before 1pm",
    free: "Free over ₦25,000",
  },
  {
    zone: "Greater Zaria (Giwa, Soba, Kudan, Makarfi)",
    rate: "₦2,000",
    eta: "24 hours",
    free: "Free over ₦25,000",
  },
  {
    zone: "Kaduna city (Kaduna North, Kaduna South, Chikun)",
    rate: "₦2,500",
    eta: "24–48 hours",
    free: "Free over ₦40,000",
  },
  {
    zone: "FCT, Ogun, Oyo, Rivers",
    rate: "₦3,500",
    eta: "2 working days",
    free: "Free over ₦75,000",
  },
  {
    zone: "South-East & South-South",
    rate: "₦4,500",
    eta: "3 working days",
    free: "Free over ₦100,000",
  },
  {
    zone: "North-Central & North-West",
    rate: "₦5,500",
    eta: "3–5 working days",
    free: "Free over ₦100,000",
  },
  {
    zone: "North-East",
    rate: "₦7,000",
    eta: "5–7 working days",
    free: "WhatsApp for bulk rate",
  },
] as const;

export default async function ShippingPage() {
  // Support/WhatsApp number is admin-editable at /admin/settings.
  const contact = await getStoreContact();
  // Real, admin-configured zones/rates (incl. LGA-level area pricing). Falls
  // back to the static marketing table below when none are configured yet.
  const [allZones, fallback] = await Promise.all([
    listShippingZones(),
    getFallbackShipping(),
  ]);
  const zones = allZones.filter((z) => z.active);
  return (
    <>
      <ContentPageHeader
        eyebrow="Help"
        title="Shipping & delivery"
        description="We ship to all 36 states and the FCT. Same-day delivery in Zaria if you order before 1pm."
        breadcrumb={[{ label: "Shipping" }]}
      />

      <div className="mx-auto max-w-5xl px-4 lg:px-6 py-10 lg:py-16">
        {/* Highlights */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <Highlight icon={Truck} title="Free Zaria" sub="On orders over ₦25,000" />
          <Highlight icon={Clock} title="Same-day" sub="Order before 1pm WAT" />
          <Highlight icon={Package} title="Bulk friendly" sub="Wholesale rates on WhatsApp" />
        </div>

        {/* Zone table */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-5">
          Zones & rates
        </h2>
        <div className="rounded-lg border border-border overflow-hidden mb-10">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-[11px] font-bold uppercase tracking-wider text-fg-muted">
              <tr>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3 hidden md:table-cell">Delivery time</th>
                <th className="px-4 py-3 hidden md:table-cell">Free shipping</th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {zones.length > 0 ? (
                <>
                  {zones.map((z) => (
                    <tr key={z.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{z.name}</div>
                        <div className="text-xs text-fg-muted mt-0.5">
                          {coverageLabel(z.states, z.areas)}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular">{formatMoney(z.baseRateKobo)}</td>
                      <td className="px-4 py-3 text-fg-muted hidden md:table-cell">{z.etaDays}</td>
                      <td className="px-4 py-3 text-fg-muted hidden md:table-cell">
                        {z.freeOverKobo != null
                          ? `Free over ${formatMoney(z.freeOverKobo)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {fallback?.enabled && (
                    <tr>
                      <td className="px-4 py-3 font-semibold">Everywhere else</td>
                      <td className="px-4 py-3 tabular">{formatMoney(fallback.flatRateKobo)}</td>
                      <td className="px-4 py-3 text-fg-muted hidden md:table-cell">{fallback.etaDays}</td>
                      <td className="px-4 py-3 text-fg-muted hidden md:table-cell">—</td>
                    </tr>
                  )}
                </>
              ) : (
                ZONES.map((z) => (
                  <tr key={z.zone}>
                    <td className="px-4 py-3 font-semibold">{z.zone}</td>
                    <td className="px-4 py-3 tabular">{z.rate}</td>
                    <td className="px-4 py-3 text-fg-muted hidden md:table-cell">{z.eta}</td>
                    <td className="px-4 py-3 text-fg-muted hidden md:table-cell">{z.free}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Couriers */}
        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-5">
          Who delivers
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <Block title="Zaria & Kaduna">
            Our in-house riders cover Zaria, Sabon Gari, and greater Kaduna. Live tracking is sent
            via WhatsApp once your rider picks up.
          </Block>
          <Block title="Inter-state">
            GIG Logistics for South, ABC for North. Tracking number is emailed and added to your
            order page.
          </Block>
        </div>

        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-5">
          Pickup
        </h2>
        <div className="rounded-lg border border-border bg-surface p-6 flex items-start gap-4 mb-10">
          <div className="size-10 rounded-md bg-info-bg text-brand-primary flex items-center justify-center flex-shrink-0">
            <MapPin className="size-5" />
          </div>
          <div>
            <div className="font-bold mb-1">Pickup at our Zaria flagship</div>
            <p className="text-sm text-fg-muted">
              {SITE.address.street}, {SITE.address.city}, {SITE.address.state}. Mon–Sat 10am–7pm.
              Choose &ldquo;Pickup&rdquo; at checkout — we will text you when it&apos;s ready, usually
              within 2 hours.
            </p>
          </div>
        </div>

        <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-5">
          A few things to know
        </h2>
        <ul className="space-y-3 text-sm lg:text-base text-fg-muted leading-relaxed list-disc pl-5 mb-10">
          <li>Delivery windows are working days. Sundays and public holidays don&apos;t count.</li>
          <li>Bulk orders (5+ items or large furniture) may need an extra day for picking.</li>
          <li>If our courier can&apos;t reach you on the first attempt, we try twice more. After that we hold for pickup or refund.</li>
          <li>If you&apos;re shipping to a hotel or guesthouse, write the receptionist&apos;s name + room number in &ldquo;Notes&rdquo; at checkout.</li>
        </ul>

        <div className="rounded-lg bg-fg text-bg p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <div className="font-bold text-lg mb-1">Bulk orders?</div>
            <p className="text-sm opacity-90">
              Wholesale rates, scheduled deliveries, and dedicated dispatch. Chat with us on WhatsApp.
            </p>
          </div>
          <Link href={storeWaLink(contact.whatsapp)} target="_blank" rel="noreferrer">
            <Button className="bg-bg text-fg hover:bg-white/95">Open WhatsApp</Button>
          </Link>
        </div>
      </div>
    </>
  );
}

/** Human-readable coverage for a zone row: whole states first, then a count of
 *  any LGA-level areas it prices. */
function coverageLabel(
  states: string[],
  areas: { state: string; lga: string }[],
): string {
  const parts: string[] = [];
  if (states.length > 0) {
    parts.push(
      states.length > 4
        ? `${states.slice(0, 4).join(", ")} +${states.length - 4} more`
        : states.join(", "),
    );
  }
  if (areas.length > 0) {
    parts.push(`${areas.length} LGA${areas.length === 1 ? "" : "s"}`);
  }
  return parts.join(" · ") || "—";
}

function Highlight({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Truck;
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

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="font-bold mb-2">{title}</div>
      <p className="text-sm text-fg-muted leading-relaxed">{children}</p>
    </div>
  );
}
