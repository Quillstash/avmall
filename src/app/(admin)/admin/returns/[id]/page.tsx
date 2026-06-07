import { notFound } from "next/navigation";
import { getAdminReturnByNumber } from "@/lib/data/returns";
import { ReturnDetailClient } from "./return-detail-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function AdminReturnDetailPage({ params }: PageProps) {
  // The list links carry the customer-facing RET-XXXXXXX number as the segment.
  const ret = await getAdminReturnByNumber(decodeURIComponent(params.id));
  if (!ret) notFound();

  return <ReturnDetailClient ret={ret} />;
}
