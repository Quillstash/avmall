import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { SITE } from "@/lib/site";
import { listPublishedJournalPosts } from "@/lib/data/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journal — Stories from Nigerian makers",
  description: `Maker stories, recipes, and the long-form behind ${SITE.name}.`,
  alternates: { canonical: "/journal" },
};

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(d);
}

export default async function JournalPage() {
  const posts = await listPublishedJournalPosts();
  const featured = posts[0] ?? null;
  const rest = posts.slice(1);

  return (
    <>
      <ContentPageHeader
        eyebrow="Journal"
        title="Stories from the makers"
        description="Recipes, workshop visits, and the long-form behind everything we sell."
        breadcrumb={[{ label: "Journal" }]}
      />

      <div className="mx-auto max-w-6xl px-4 lg:px-6 py-10 lg:py-16">
        {posts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center">
            <p className="text-sm text-fg-muted">No stories published yet. Check back soon.</p>
          </div>
        ) : (
          <>
            {/* Featured */}
            {featured && (
              <Link href={`/journal/${featured.slug}`} className="group block mb-12 lg:mb-16">
                <article className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-surface-2">
                    {featured.coverImage && (
                      <Image
                        src={featured.coverImage}
                        alt={featured.title}
                        fill
                        sizes="(min-width: 1024px) 50vw, 100vw"
                        priority
                        className="object-cover transition-transform duration-page ease-out-expo group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-brand-primary mb-3">
                      Featured{featured.category ? ` · ${featured.category}` : ""}
                    </div>
                    <h2 className="font-display text-2xl lg:text-4xl font-semibold tracking-tight leading-tight mb-4">
                      {featured.title}
                    </h2>
                    <p className="text-sm lg:text-base text-fg-muted leading-relaxed mb-5">
                      {featured.excerpt}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-fg-muted">
                      <span>{fmtDate(featured.publishedAt)}</span>
                      {featured.readTime && (
                        <>
                          <span>·</span>
                          <span>{featured.readTime}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary group-hover:underline">
                      Read the story <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                </article>
              </Link>
            )}

            {/* Grid */}
            {rest.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {rest.map((p) => (
                  <Link key={p.slug} href={`/journal/${p.slug}`} className="group block">
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-surface-2 mb-4">
                      {p.coverImage && (
                        <Image
                          src={p.coverImage}
                          alt={p.title}
                          fill
                          sizes="(min-width: 1024px) 33vw, 50vw"
                          className="object-cover transition-transform duration-page ease-out-expo group-hover:scale-105"
                        />
                      )}
                    </div>
                    {p.category && (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-2">
                        {p.category}
                      </div>
                    )}
                    <h3 className="font-display text-lg lg:text-xl font-semibold tracking-tight leading-snug mb-2 group-hover:text-brand-primary">
                      {p.title}
                    </h3>
                    <p className="text-sm text-fg-muted leading-relaxed line-clamp-2 mb-3">
                      {p.excerpt}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-fg-muted">
                      <span>{fmtDate(p.publishedAt)}</span>
                      {p.readTime && (
                        <>
                          <span>·</span>
                          <span>{p.readTime}</span>
                        </>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

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
