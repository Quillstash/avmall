import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { JournalEditor, type JournalDraft } from "../journal-editor";

export const dynamic = "force-dynamic";

const EMPTY: JournalDraft = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  coverImage: "",
  category: "",
  author: "",
  readTime: "",
  published: false,
  publishedAt: "",
};

export default function NewJournalPostPage() {
  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Content", href: "/admin/content" },
          { label: "Journal", href: "/admin/content/journal" },
          { label: "New post" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1000px] mx-auto pb-20">
          <PageHeader title="New journal post" subtitle="Draft it, then publish when ready" />
          <JournalEditor initial={EMPTY} />
        </div>
      </div>
    </>
  );
}
