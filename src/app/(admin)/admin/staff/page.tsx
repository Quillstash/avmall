import { listStaff } from "@/lib/data/staff";
import { StaffClient } from "./staff-client";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const staff = await listStaff();
  return <StaffClient initialStaff={staff} />;
}
