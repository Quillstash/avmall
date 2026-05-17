import { listCustomers } from "@/lib/data/customers";
import { CustomersClient } from "./customers-client";

export const dynamic = "force-dynamic";

export default async function AdminCustomersListPage() {
  const customers = await listCustomers();
  return <CustomersClient customers={customers} />;
}
