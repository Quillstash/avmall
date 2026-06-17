import { listCustomers } from "@/lib/data/customers";
import { getActiveAdminStoreId } from "@/lib/store";
import { CustomersClient } from "./customers-client";

export const dynamic = "force-dynamic";

export default async function AdminCustomersListPage() {
  const storeId = await getActiveAdminStoreId();
  const customers = await listCustomers(storeId);
  return <CustomersClient customers={customers} />;
}
