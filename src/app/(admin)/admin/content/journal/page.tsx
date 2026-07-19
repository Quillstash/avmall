import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { listAllJournalPosts } from "@/lib/data/content";
import { JournalListClient } from "./journal-list-client";

export const dynamic = "force-dynamic";

export default async function AdminJournalPage() {
  const posts = await listAllJournalPosts();
  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Content", href: "/admin/content" },
          { label: "Journal" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1000px] mx-auto pb-16">
          <PageHeader title="Journal" subtitle="Write and publish blog posts" />
          <JournalListClient posts={posts} />
        </div>
      </div>
    </>
  );
}
