import { listProducts, listCategories } from "@/lib/data/products";
import { getActiveAdminStoreId } from "@/lib/store";
import { ProductsListClient } from "./products-client";

export const dynamic = "force-dynamic";

export default async function AdminProductsListPage() {
  const storeId = await getActiveAdminStoreId();
  // No limit — show the store's ENTIRE catalogue. A cap here silently hides
  // products and makes the "N products" stat lie (it counted the capped page,
  // not the real total). The client table paginates in-memory.
  const products = await listProducts({
    includeUnpublished: true,
    ...(storeId ? { storeId } : {}),
  });
  const categories = await listCategories();
  return <ProductsListClient products={products} categories={categories} />;
}
