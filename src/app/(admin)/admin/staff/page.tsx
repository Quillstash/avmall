import { listStaff, listStaffInvitations } from "@/lib/data/staff";
import { listRoles } from "@/lib/data/roles";
import { StaffClient } from "./staff-client";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const [staff, invitations, roles] = await Promise.all([
    listStaff(),
    listStaffInvitations(),
    listRoles(),
  ]);
  return (
    <StaffClient
      initialStaff={staff}
      initialInvitations={invitations}
      initialRoles={roles}
    />
  );
}
