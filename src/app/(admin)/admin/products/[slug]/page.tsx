import { notFound } from "next/navigation";
import {
  getProductBySlug,
  getProductAuditSummary,
  listCategories,
} from "@/lib/data/products";
import { ProductEditorClient } from "./editor-client";

// Read live product data — without this the page would fall back to mock
// variant IDs and the stock-adjust API would reject them as non-UUIDs.
export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

export default async function AdminProductEditorPage({ params }: PageProps) {
  const product = await getProductBySlug(params.slug);
  if (!product) notFound();
  const audit = await getProductAuditSummary(product.id);
  const categories = await listCategories();
  return (
    <ProductEditorClient product={product} audit={audit} categories={categories} />
  );
}
