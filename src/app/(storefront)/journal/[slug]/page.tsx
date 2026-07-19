import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ContentPageHeader } from "@/components/storefront/page-header";
import { Markdown } from "@/components/ui/markdown";
import { SITE } from "@/lib/site";
import { getPublishedJournalPost } from "@/lib/data/content";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(d);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getPublishedJournalPost(params.slug);
  if (!post) return { title: "Story not found" };
  return {
    title: `${post.title} — ${SITE.name} Journal`,
    description: post.excerpt,
    alternates: { canonical: `/journal/${post.slug}` },
    ...(post.coverImage && { openGraph: { images: [post.coverImage] } }),
  };
}

export default async function JournalPostPage({ params }: PageProps) {
  const post = await getPublishedJournalPost(params.slug);
  if (!post) notFound();

  return (
    <>
      <ContentPageHeader
        eyebrow={post.category || "Journal"}
        title={post.title}
        description={post.excerpt}
        breadcrumb={[{ label: "Journal", href: "/journal" }, { label: post.title }]}
      />

      <article className="mx-auto max-w-3xl px-4 lg:px-6 py-10 lg:py-16">
        <div className="flex items-center gap-3 text-xs text-fg-muted mb-8">
          {post.author && <span className="font-semibold text-fg">{post.author}</span>}
          {post.author && <span>·</span>}
          <span>{fmtDate(post.publishedAt)}</span>
          {post.readTime && (
            <>
              <span>·</span>
              <span>{post.readTime}</span>
            </>
          )}
        </div>

        {post.coverImage && (
          <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-surface-2 mb-10">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              sizes="(min-width: 768px) 768px, 100vw"
              priority
              className="object-cover"
            />
          </div>
        )}

        {post.body.trim() ? (
          <Markdown>{post.body}</Markdown>
        ) : (
          <p className="text-sm lg:text-base text-fg-muted leading-relaxed">{post.excerpt}</p>
        )}

        <div className="mt-12 pt-8 border-t border-border">
          <Link
            href="/journal"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Back to the journal
          </Link>
        </div>
      </article>
    </>
  );
}
