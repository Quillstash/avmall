import { listAdminReturns } from "@/lib/data/returns";
import { ReturnsClient } from "./returns-client";

export const dynamic = "force-dynamic";

export default async function AdminReturnsListPage() {
  const returns = await listAdminReturns();
  return <ReturnsClient returns={returns} />;
}
