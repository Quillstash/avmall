import { listStaff, listStaffInvitations } from "@/lib/data/staff";
import { listRoles } from "@/lib/data/roles";
import { listActiveStores, getActiveAdminStoreId } from "@/lib/store";
import { StaffClient } from "./staff-client";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const [staff, invitations, roles, stores, defaultStoreId] = await Promise.all([
    listStaff(),
    listStaffInvitations(),
    listRoles(),
    listActiveStores(),
    getActiveAdminStoreId(),
  ]);
  return (
    <StaffClient
      initialStaff={staff}
      initialInvitations={invitations}
      initialRoles={roles}
      stores={stores.map((s) => ({ id: s.id, name: s.name }))}
      defaultStoreId={defaultStoreId}
    />
  );
}
