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
import { listProducts } from "@/lib/data/products";

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
    id: "beauty",
    name: "Beauty & Skincare",
    count: 84,
    image:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&q=80&auto=format&fit=crop",
  },
  {
    id: "home",
    name: "Home & Living",
    count: 142,
    image:
      "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&q=80&auto=format&fit=crop",
  },
  {
    id: "fashion",
    name: "Fashion",
    count: 67,
    image:
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&q=80&auto=format&fit=crop",
  },
  {
    id: "food",
    name: "Pantry",
    count: 51,
    image:
      "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=1200&q=80&auto=format&fit=crop",
  },
];

export default async function HomePage() {
  const all = await listProducts({ limit: 8, featuredFirst: true });
  const newArrivals = all.slice(0, 4);
  const bestsellers = all.slice(4, 8).length === 4 ? all.slice(4, 8) : all.slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 lg:pt-10">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-0 rounded-xl overflow-hidden border border-border bg-surface min-h-[420px] lg:min-h-[480px]">
          <div className="p-8 sm:p-12 lg:p-14 flex flex-col justify-center">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-primary mb-4">
              New season · January 2026
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[60px] font-semibold leading-[1.05] tracking-tight mb-5">
              Made by Nigerian
              <br className="hidden sm:inline" /> hands. Built for
              <br className="hidden sm:inline" /> everyday rituals.
            </h1>
            <p className="text-base lg:text-lg leading-relaxed text-fg-muted max-w-md mb-8">
              From Aramide&apos;s clay masks to Tafa Studio&apos;s stoneware — discover 332 small-batch
              goods from 47 makers across the country, with same-day delivery in Lagos.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/category/beauty">
                <Button size="lg">Shop new arrivals</Button>
              </Link>
              <Button size="lg" variant="secondary" className="bg-transparent">
                <MessageCircle className="size-4" /> Chat with us
              </Button>
            </div>
            <div className="mt-9 flex flex-wrap gap-7 text-sm text-fg-muted">
              {[
                "47 verified makers",
                "Pay via Nuqood, transfer, POS",
                "14-day returns",
              ].map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-brand-accent" />
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="relative bg-gradient-to-br from-[#d97757] via-[#b54a30] to-[#6b2a18] flex items-end p-8 lg:p-10 text-white min-h-[280px] lg:min-h-0">
            <Image
              src="https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1400&q=80&auto=format&fit=crop"
              alt="Featured product"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover opacity-50 mix-blend-multiply"
              priority
            />
            <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-[11px] font-bold uppercase tracking-widest">
              Featured
            </div>
            <div className="relative max-w-sm">
              <div className="text-[11px] font-bold uppercase tracking-widest opacity-85 mb-2">
                Aramide
              </div>
              <div className="font-display text-2xl lg:text-3xl font-semibold leading-tight mb-2.5">
                Rose &amp; Clay Hydrating Mask
              </div>
              <div className="text-sm opacity-90 mb-5 leading-relaxed">
                Detoxifies and softens. 17% off this week.
              </div>
              <Link href="/product/aramide-rose-clay-mask">
                <Button className="bg-white text-fg hover:bg-white/90">
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
          rightLink={{ label: "View all 84", href: "/category/beauty" }}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {newArrivals.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      </section>

      {/* Editorial split */}
      <section className="mx-auto max-w-7xl px-4 lg:px-6 pt-16 lg:pt-24">
        <div className="grid lg:grid-cols-2 gap-5 lg:gap-6">
          {/* Maker story */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1f6f4a] to-[#0d4a2c] text-white p-10 lg:p-14 min-h-[360px] flex flex-col justify-between">
            <Image
              src="https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1200&q=80&auto=format&fit=crop"
              alt="Maker story"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover opacity-30 mix-blend-multiply"
            />
            <div className="relative">
              <div className="text-[11px] font-bold uppercase tracking-widest opacity-85">
                Maker story
              </div>
              <div className="font-display text-3xl lg:text-4xl font-semibold leading-tight mt-3.5 max-w-sm">
                Omolewa, on shea butter and slow rituals
              </div>
              <p className="text-sm lg:text-base leading-relaxed opacity-90 mt-4 max-w-lg">
                &ldquo;My grandmother whipped shea on the back porch. The recipe hasn&apos;t changed —
                only the people we share it with.&rdquo;
              </p>
            </div>
            <button className="relative self-start mt-6 px-5 py-3 rounded-md border-2 border-white/60 text-white text-sm font-semibold hover:bg-white/10 inline-flex items-center gap-2">
              Read the story <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Wholesale CTA */}
          <div className="rounded-xl bg-surface border border-border p-10 lg:p-14 min-h-[360px] flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-primary">
                Buying for your shop?
              </div>
              <div className="font-display text-3xl lg:text-4xl font-semibold leading-tight mt-3.5 max-w-sm">
                Wholesale that respects your margins.
              </div>
              <p className="text-sm lg:text-base leading-relaxed text-fg-muted mt-4 max-w-lg">
                Tiered bulk pricing, negotiate on WhatsApp, split payments, dedicated account
                manager. Trusted by 240+ retailers across Nigeria.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[
                  { v: "15%", l: "off at 50+ units" },
                  { v: "24h", l: "Lagos delivery" },
                  { v: "₦2M", l: "avg first order" },
                ].map((s) => (
                  <div key={s.l} className="p-3 rounded-md bg-surface-2">
                    <div className="font-display text-2xl font-bold tracking-tight">{s.v}</div>
                    <div className="text-[11px] text-fg-muted mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <Button size="lg" className="self-start mt-6">
              <MessageCircle className="size-4" /> Open a wholesale chat
            </Button>
          </div>
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
      <section className="mx-auto max-w-7xl px-4 lg:px-6 pt-20 lg:pt-28 pb-4">
        <div className="rounded-xl p-10 lg:p-14 bg-fg text-bg grid lg:grid-cols-2 gap-10 items-center">
          <div className="font-display text-3xl lg:text-4xl font-semibold leading-tight tracking-tight">
            Drops, stories, and
            <br />
            early access — once a fortnight.
          </div>
          <div>
            <p className="text-sm lg:text-base leading-relaxed opacity-80 mb-4">
              No spam. Unsubscribe anytime. We never share your details.
            </p>
            <div className="flex gap-2">
              <input
                placeholder="you@email.com"
                className="flex-1 h-12 px-4 rounded-md bg-white/10 text-white placeholder:text-white/50 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              <button className="px-6 h-12 rounded-md bg-bg text-fg font-bold text-sm hover:bg-white/95 inline-flex items-center gap-2">
                Subscribe <ArrowRight className="size-4" />
              </button>
            </div>
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
