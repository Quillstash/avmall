import { listStores } from "@/lib/data/stores";
import { StoresClient } from "./stores-client";

// Always reflect live store config.
export const dynamic = "force-dynamic";

export default async function AdminStoresPage() {
  const stores = await listStores();
  return <StoresClient stores={stores} />;
}
