import Link from "next/link";
import { FileText, Newspaper, ArrowRight } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { listAllJournalPosts } from "@/lib/data/content";

export const dynamic = "force-dynamic";

const PAGES = [
  { key: "about", label: "About", desc: "Story, values, and the maker CTA" },
  { key: "makers", label: "Makers", desc: "Onboarding pitch, benefits, and steps" },
  { key: "careers", label: "Careers", desc: "Values and open job roles" },
] as const;

export default async function AdminContentPage() {
  const posts = await listAllJournalPosts().catch(() => []);
  const published = posts.filter((p) => p.published).length;

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Content" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[900px] mx-auto pb-16">
          <PageHeader
            title="Content"
            subtitle="Edit the storefront's About, Makers, Careers pages and the Journal blog"
          />

          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            {PAGES.map((p) => (
              <Link
                key={p.key}
                href={`/admin/content/${p.key}`}
                className="group rounded-lg border border-border bg-surface p-5 hover:border-border-strong transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-md bg-info-bg text-brand-primary flex items-center justify-center flex-shrink-0">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-1.5">
                      {p.label}
                      <ArrowRight className="size-3.5 text-fg-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-xs text-fg-muted mt-0.5">{p.desc}</div>
                  </div>
                </div>
              </Link>
            ))}

            <Link
              href="/admin/content/journal"
              className="group rounded-lg border border-border bg-surface p-5 hover:border-border-strong transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-md bg-success-bg text-brand-accent flex items-center justify-center flex-shrink-0">
                  <Newspaper className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-1.5">
                    Journal
                    <ArrowRight className="size-3.5 text-fg-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-xs text-fg-muted mt-0.5">
                    {posts.length} post{posts.length === 1 ? "" : "s"} · {published} published
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
