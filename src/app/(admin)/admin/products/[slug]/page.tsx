import { notFound } from "next/navigation";
import {
  getProductBySlug,
  getProductAuditSummary,
  listCategories,
} from "@/lib/data/products";
import { getProductSalesHistory } from "@/lib/data/product-history";
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
  const [audit, categories, history] = await Promise.all([
    getProductAuditSummary(product.id),
    listCategories(),
    getProductSalesHistory(product.id),
  ]);
  return (
    <ProductEditorClient
      product={product}
      audit={audit}
      categories={categories}
      history={history}
    />
  );
}
