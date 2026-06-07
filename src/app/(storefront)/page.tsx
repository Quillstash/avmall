import Image from "next/image";
import Link from "next/link";
import {
  Truck,
  Shield,
  Package,
  MessageCircle,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/product-card";
import { NewsletterSignup } from "@/components/storefront/newsletter-signup";
import { listProducts } from "@/lib/data/products";
import { getStorefrontStoreId } from "@/lib/store";
import { SITE } from "@/lib/site";

// Live product data — revalidate every 5 min so first request after a cold
// Neon wake-up isn't a hard prerender failure during build.
export const revalidate = 300;
export const dynamic = "force-dynamic";

const TRUST_ITEMS = [
  { t: "Same-day Lagos", s: "Order before 1pm" },
  { t: "Pay your way", s: "Nuqood · transfer · POS · cash" },
  { t: "14-day returns", s: "Free pickup" },
  { t: "Negotiate on WhatsApp", s: "For bulk orders, with our AI" },
];

const CATEGORY_VISUALS = [
  {
    id: "phones",
    name: "Phones & Tablets",
    count: 22,
    image:
      "https://dodptt9f4zk9h.cloudfront.net/stores/114586/products/b3ea24c913fe86987703aae05401eb1fb0ea9201.jpeg",
  },
  {
    id: "audio",
    name: "Audio",
    count: 26,
    image:
      "https://dodptt9f4zk9h.cloudfront.net/stores/114586/products/b648d085c3de78cd526b13a44047d59723b88d18.jpeg",
  },
  {
    id: "power",
    name: "Power",
    count: 25,
    image:
      "https://dodptt9f4zk9h.cloudfront.net/stores/114586/products/27756b025a9c2d6488d67a8ac2991262b7099557.jpeg",
  },
  {
    id: "fans",
    name: "Fans",
    count: 24,
    image:
      "https://dodptt9f4zk9h.cloudfront.net/stores/114586/products/73d90ad2510d39de57a57f3797abdcc5dc2e3c82.jpeg",
  },
];

export default async function HomePage() {
  const storeId = await getStorefrontStoreId();
  const all = await listProducts({
    limit: 8,
    featuredFirst: true,
    ...(storeId ? { storeId } : {}),
  });
  const newArrivals = all.slice(0, 4);
  const bestsellers = all.slice(4, 8).length === 4 ? all.slice(4, 8) : all.slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 lg:pt-10">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-0 rounded-xl overflow-hidden border border-border bg-surface min-h-[360px] lg:min-h-[420px]">
          <div className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-primary mb-4">
              On the shelf today
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.1] tracking-tight mb-4">
              Phones, power, audio,
              <br className="hidden sm:inline" /> shipped today.
            </h1>
            <p className="text-base leading-relaxed text-fg-muted max-w-md mb-7">
              Same-day Lagos dispatch. 14-day returns. Pay how you want — Nuqood, transfer,
              POS or cash.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/category/phones">
                <Button size="lg">Shop the catalogue</Button>
              </Link>
              <Button size="lg" variant="secondary" className="bg-transparent">
                <MessageCircle className="size-4" /> Chat with us
              </Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-7 text-sm text-fg-muted">
              {[
                "120+ products in stock",
                "Same-day Lagos",
                "14-day returns",
              ].map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-brand-accent" />
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="relative bg-[#0a3322] flex items-end p-8 lg:p-10 text-white min-h-[280px] lg:min-h-0">
            <Image
              src="https://dodptt9f4zk9h.cloudfront.net/stores/114586/products/27756b025a9c2d6488d67a8ac2991262b7099557.jpeg"
              alt="Featured Oraimo power bank"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              priority
            />
            {/* Bottom-anchored darkening gradient so the text below stays readable
                without dimming the product itself. */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a3322]/95 via-[#0a3322]/55 to-transparent" />
            <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-[11px] font-bold uppercase tracking-widest">
              Featured
            </div>
            <div className="relative max-w-sm">
              <div className="text-[11px] font-bold uppercase tracking-widest opacity-85 mb-2">
                Oraimo
              </div>
              <div className="font-display text-2xl lg:text-3xl font-semibold leading-tight mb-2.5">
                50,000mAh laptop-grade power bank
              </div>
              <div className="text-sm opacity-90 mb-5 leading-relaxed">
                Multi-day backup for phones, lamps, and small fans. In stock today.
              </div>
              <Link href="/product/oraimo-50000mah-powerbank">
                <Button className="bg-white text-zinc-900 hover:bg-white/90">
                  Shop the drop <ChevronRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 mt-4 rounded-lg overflow-hidden border border-border bg-border">
          {TRUST_ITEMS.map((b) => (
            <div key={b.t} className="bg-surface p-5 lg:p-6 lg:border-r last:border-r-0 border-border">
              <div className="text-sm font-bold">{b.t}</div>
              <div className="text-xs text-fg-muted mt-0.5">{b.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 lg:px-6 pt-16 lg:pt-24">
        <SectionHead eyebrow="Browse" title="By the room you're in" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORY_VISUALS.map((c) => (
            <Link
              key={c.id}
              href={`/category/${c.id}`}
              className="group relative aspect-[4/5] lg:aspect-square overflow-hidden rounded-lg"
            >
              <Image
                src={c.image}
                alt={c.name}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-page ease-out-expo group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-fg/70 via-fg/20 to-transparent" />
              <div className="absolute inset-0 p-5 lg:p-6 flex flex-col justify-between text-white">
                <div className="text-[10px] lg:text-[11px] font-bold uppercase tracking-widest opacity-85">
                  {c.count} products
                </div>
                <div>
                  <div className="font-display text-xl lg:text-2xl font-semibold leading-tight">
                    {c.name}
                  </div>
                  <div className="text-sm opacity-85 mt-1 inline-flex items-center gap-1">
                    Shop now <ChevronRight className="size-3" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* New arrivals */}
      <section className="mx-auto max-w-7xl px-4 lg:px-6 pt-16 lg:pt-24">
        <SectionHead
          eyebrow="Just dropped"
          title="New arrivals"
          rightLink={{ label: "Browse phones", href: "/category/phones" }}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {newArrivals.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      </section>

      {/* Wholesale band — slim full-width */}
      <section className="mx-auto max-w-7xl px-4 lg:px-6 pt-16 lg:pt-24">
        <div className="rounded-xl bg-surface border border-border p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-primary mb-2">
              Buying for your shop?
            </div>
            <div className="font-display text-xl lg:text-2xl font-semibold leading-tight tracking-tight">
              Wholesale pricing, negotiated on WhatsApp.
            </div>
            <p className="text-sm text-fg-muted mt-2 max-w-xl">
              Tiered bulk discounts, split payments, dedicated account manager — chat with
              us to get a quote for your shop.
            </p>
          </div>
          <a
            href={`https://wa.me/${SITE.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent("Hi, I'm interested in wholesale pricing for my shop.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Button size="lg">
              <MessageCircle className="size-4" /> Open a wholesale chat
            </Button>
          </a>
        </div>
      </section>

      {/* Bestsellers */}
      <section className="mx-auto max-w-7xl px-4 lg:px-6 pt-16 lg:pt-24">
        <SectionHead
          eyebrow="What everyone's buying"
          title="Bestsellers this week"
          rightLink={{ label: "View all", href: "/category/home" }}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {bestsellers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Trust band (mobile-friendly summary) */}
      <section className="mx-auto max-w-7xl px-4 lg:px-6 pt-16 lg:pt-24">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {[
            { icon: Truck, t: "Fast delivery", s: "24h Lagos · 2–5d nationwide" },
            { icon: Shield, t: "Secure checkout", s: "Nuqood · transfer · POS" },
            { icon: Package, t: "Easy returns", s: "14 days, no questions" },
            { icon: MessageCircle, t: "Real humans", s: "WhatsApp 8am–9pm" },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.t}
                className="flex items-start gap-3 p-4 lg:p-5 rounded-lg bg-surface border border-border"
              >
                <div className="size-10 rounded-md bg-info-bg text-brand-primary flex items-center justify-center flex-shrink-0">
                  <Icon className="size-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">{b.t}</div>
                  <div className="text-xs text-fg-muted mt-0.5">{b.s}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Newsletter slab */}
      <section className="mx-auto max-w-7xl px-4 lg:px-6 pt-16 lg:pt-28 pb-4">
        <div className="rounded-xl p-6 sm:p-8 lg:p-14 bg-fg text-bg grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
          <div className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight tracking-tight">
            Drops, stories, and early access — once a fortnight.
          </div>
          <div className="min-w-0">
            <p className="text-sm lg:text-base leading-relaxed opacity-80 mb-4">
              No spam. Unsubscribe anytime. We never share your details.
            </p>
            <NewsletterSignup />
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  rightLink,
}: {
  eyebrow: string;
  title: string;
  rightLink?: { label: string; href: string };
}) {
  return (
    <div className="flex items-end justify-between mb-6 lg:mb-8">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-primary mb-2">
          {eyebrow}
        </div>
        <h2 className="font-display text-2xl lg:text-4xl font-semibold tracking-tight">{title}</h2>
      </div>
      {rightLink && (
        <Link
          href={rightLink.href}
          className="text-sm font-semibold text-fg hover:text-brand-primary inline-flex items-center gap-1"
        >
          {rightLink.label} <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
