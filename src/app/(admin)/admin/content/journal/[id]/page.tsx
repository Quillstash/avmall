import { notFound } from "next/navigation";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { getJournalPostForAdmin } from "@/lib/data/content";
import { JournalEditor, type JournalDraft } from "../journal-editor";

export const dynamic = "force-dynamic";

export default async function EditJournalPostPage({
  params,
}: {
  params: { id: string };
}) {
  const p = await getJournalPostForAdmin(params.id);
  if (!p) notFound();

  const initial: JournalDraft = {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    body: p.body,
    coverImage: p.coverImage ?? "",
    category: p.category,
    author: p.author ?? "",
    readTime: p.readTime ?? "",
    published: p.published,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString().slice(0, 10) : "",
  };

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Content", href: "/admin/content" },
          { label: "Journal", href: "/admin/content/journal" },
          { label: p.title },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1000px] mx-auto pb-20">
          <PageHeader title="Edit post" subtitle={`/journal/${p.slug}`} />
          <JournalEditor initial={initial} />
        </div>
      </div>
    </>
  );
}
