import { notFound } from "next/navigation";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import {
  getAboutContent,
  getMakersContent,
  getCareersContent,
  isContentKey,
} from "@/lib/data/content";
import { AboutEditor } from "./about-editor";
import { MakersEditor } from "./makers-editor";
import { CareersEditor } from "./careers-editor";

export const dynamic = "force-dynamic";

const LABELS: Record<string, { title: string; subtitle: string }> = {
  about: { title: "About page", subtitle: "Story, values, and the maker CTA" },
  makers: { title: "Makers page", subtitle: "Onboarding pitch, benefits, and steps" },
  careers: { title: "Careers page", subtitle: "Values and open job roles" },
};

export default async function ContentPageEditor({
  params,
}: {
  params: { key: string };
}) {
  if (!isContentKey(params.key)) notFound();
  const meta = LABELS[params.key]!;

  return (
    <>
      <AdminTopBar
        breadcrumbs={[
          { label: "Content", href: "/admin/content" },
          { label: meta.title },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[900px] mx-auto pb-20">
          <PageHeader title={meta.title} subtitle={meta.subtitle} />
          {params.key === "about" && <AboutEditor initial={await getAboutContent()} />}
          {params.key === "makers" && <MakersEditor initial={await getMakersContent()} />}
          {params.key === "careers" && <CareersEditor initial={await getCareersContent()} />}
        </div>
      </div>
    </>
  );
}
