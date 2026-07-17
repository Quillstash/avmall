import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Journal — Stories from Nigerian makers",
  description: `Maker stories, recipes, and the long-form behind ${SITE.name}.`,
  alternates: { canonical: "/journal" },
};

const POSTS = [
  {
    slug: "omolewa-shea-butter",
    title: "Omolewa, on shea butter and slow rituals",
    excerpt:
      "Three generations of women, one stainless-steel pot, and the recipe Omolewa won&rsquo;t let us write down.",
    image:
      "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=1200&q=80&auto=format&fit=crop",
    category: "Maker",
    date: "1 May 2026",
    readTime: "8 min read",
  },
  {
    slug: "aba-leather",
    title: "Aba&rsquo;s leather workshops, photographed for the first time",
    excerpt:
      "A morning with the Ade-and-sons workshop on Faulks Road, where every Avmall tote starts its life.",
    image:
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&q=80&auto=format&fit=crop",
    category: "Makers",
    date: "18 April 2026",
    readTime: "6 min read",
  },
  {
    slug: "harmattan-pantry",
    title: "The harmattan pantry: five staples for dry-season cooking",
    excerpt:
      "Smoked dried fish, suya pepper, palm nut purée, ofada rice, and a kuli-kuli that&rsquo;s changed our brunches.",
    image:
      "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=1200&q=80&auto=format&fit=crop",
    category: "Recipe",
    date: "30 March 2026",
    readTime: "5 min read",
  },
  {
    slug: "iba-silk",
    title: "Why Iba weaves with their hands, in a factory age",
    excerpt:
      "A studio visit in Zaria with the silk-scarf weavers who&rsquo;ve quietly become an Avmall bestseller.",
    image:
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1200&q=80&auto=format&fit=crop",
    category: "Maker",
    date: "12 March 2026",
    readTime: "9 min read",
  },
] as const;

export default function JournalPage() {
  return (
    <>
      <ContentPageHeader
        eyebrow="Journal"
        title="Stories from the makers"
        description="Recipes, workshop visits, and the long-form behind everything we sell."
        breadcrumb={[{ label: "Journal" }]}
      />

      <div className="mx-auto max-w-6xl px-4 lg:px-6 py-10 lg:py-16">
        {/* Featured */}
        <Link href={`/journal/${POSTS[0]!.slug}`} className="group block mb-12 lg:mb-16">
          <article className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-surface-2">
              <Image
                src={POSTS[0]!.image}
                alt={POSTS[0]!.title}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
                className="object-cover transition-transform duration-page ease-out-expo group-hover:scale-105"
              />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-primary mb-3">
                Featured · {POSTS[0]!.category}
              </div>
              <h2
                className="font-display text-2xl lg:text-4xl font-semibold tracking-tight leading-tight mb-4"
                dangerouslySetInnerHTML={{ __html: POSTS[0]!.title }}
              />
              <p
                className="text-sm lg:text-base text-fg-muted leading-relaxed mb-5"
                dangerouslySetInnerHTML={{ __html: POSTS[0]!.excerpt }}
              />
              <div className="flex items-center gap-3 text-xs text-fg-muted">
                <span>{POSTS[0]!.date}</span>
                <span>·</span>
                <span>{POSTS[0]!.readTime}</span>
              </div>
              <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary group-hover:underline">
                Read the story <ArrowRight className="size-3.5" />
              </div>
            </div>
          </article>
        </Link>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {POSTS.slice(1).map((p) => (
            <Link key={p.slug} href={`/journal/${p.slug}`} className="group block">
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-surface-2 mb-4">
                <Image
                  src={p.image}
                  alt={p.title}
                  fill
                  sizes="(min-width: 1024px) 33vw, 50vw"
                  className="object-cover transition-transform duration-page ease-out-expo group-hover:scale-105"
                />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-2">
                {p.category}
              </div>
              <h3
                className="font-display text-lg lg:text-xl font-semibold tracking-tight leading-snug mb-2 group-hover:text-brand-primary"
                dangerouslySetInnerHTML={{ __html: p.title }}
              />
              <p
                className="text-sm text-fg-muted leading-relaxed line-clamp-2 mb-3"
                dangerouslySetInnerHTML={{ __html: p.excerpt }}
              />
              <div className="flex items-center gap-2 text-xs text-fg-muted">
                <span>{p.date}</span>
                <span>·</span>
                <span>{p.readTime}</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-16 rounded-xl bg-surface-2 p-8 lg:p-10 text-center">
          <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-tight mb-2">
            The fortnightly drop
          </h2>
          <p className="text-sm text-fg-muted mb-5">
            New maker stories, recipes, and product drops — every other Sunday, no spam.
          </p>
          <Link href="/#newsletter" className="text-sm font-semibold text-brand-primary hover:underline">
            Subscribe to the newsletter →
          </Link>
        </div>
      </div>
    </>
  );
}
