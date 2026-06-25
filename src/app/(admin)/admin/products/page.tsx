import { listProducts, listCategories } from "@/lib/data/products";
import { getActiveAdminStoreId } from "@/lib/store";
import { ProductsListClient } from "./products-client";

export const dynamic = "force-dynamic";

export default async function AdminProductsListPage() {
  const storeId = await getActiveAdminStoreId();
  const products = await listProducts({
    limit: 200,
    includeUnpublished: true,
    ...(storeId ? { storeId } : {}),
  });
  const categories = await listCategories();
  return <ProductsListClient products={products} categories={categories} />;
}
