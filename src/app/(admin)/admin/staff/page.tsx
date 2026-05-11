import { Plus, MoreHorizontal, Check, X, Shield, ShieldCheck } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STAFF, ROLE_LABELS, type StaffRole } from "@/lib/admin-mock-data";

const ROLE_TONE: Record<StaffRole, "brand" | "info" | "success" | "warning" | "neutral"> = {
  super_admin: "brand",
  manager: "info",
  sales: "success",
  inventory: "warning",
  support: "neutral",
};

// Permission matrix from CLAUDE.md §8 + Appendix C
const PERMISSIONS: { group: string; rows: { label: string; roles: StaffRole[] }[] }[] = [
  {
    group: "Orders",
    rows: [
      { label: "View orders", roles: ["super_admin", "manager", "sales", "support"] },
      { label: "Create orders", roles: ["super_admin", "manager", "sales"] },
      { label: "Edit orders", roles: ["super_admin", "manager", "sales"] },
      { label: "Cancel orders", roles: ["super_admin", "manager"] },
      { label: "Apply manual discount", roles: ["super_admin", "manager"] },
      { label: "Override partial-paid → shipped", roles: ["super_admin", "manager"] },
    ],
  },
  {
    group: "Products",
    rows: [
      { label: "View products", roles: ["super_admin", "manager", "sales", "inventory", "support"] },
      { label: "Create products", roles: ["super_admin", "manager"] },
      { label: "Edit pricing", roles: ["super_admin", "manager"] },
      { label: "Stock adjust", roles: ["super_admin", "manager", "inventory"] },
      { label: "Delete products", roles: ["super_admin"] },
    ],
  },
  {
    group: "Customers",
    rows: [
      { label: "View customers", roles: ["super_admin", "manager", "sales", "support"] },
      { label: "Edit customers", roles: ["super_admin", "manager", "support"] },
      { label: "Blacklist customers", roles: ["super_admin", "manager"] },
      { label: "Issue store credit", roles: ["super_admin", "manager", "support"] },
    ],
  },
  {
    group: "Settings",
    rows: [
      { label: "Manage staff", roles: ["super_admin", "manager"] },
      { label: "Settings", roles: ["super_admin"] },
      { label: "Billing", roles: ["super_admin"] },
    ],
  },
];

const ROLES_LIST: StaffRole[] = ["super_admin", "manager", "sales", "inventory", "support"];

export default function AdminStaffPage() {
  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Staff & roles" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <PageHeader
            title="Staff & roles"
            subtitle={`${STAFF.length} staff members · ${ROLES_LIST.length} roles`}
            actions={
              <Button size="sm">
                <Plus className="size-3.5" /> Invite staff
              </Button>
            }
          />

          {/* Staff table */}
          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-border">
              <div className="text-sm font-bold">Staff members</div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface-2">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                  <th className="text-left px-3.5 py-2.5">Name</th>
                  <th className="text-left px-3.5 py-2.5">Email</th>
                  <th className="text-left px-3.5 py-2.5">Role</th>
                  <th className="text-left px-3.5 py-2.5">2FA</th>
                  <th className="text-left px-3.5 py-2.5">Last seen</th>
                  <th className="text-left px-3.5 py-2.5">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {STAFF.map((s) => {
                  const initials = s.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase();
                  return (
                    <tr key={s.id} className="border-t border-border hover:bg-surface-2">
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="size-9 rounded-full bg-gradient-to-br from-brand-primary to-[hsl(262_60%_48%)] text-white flex items-center justify-center font-bold text-xs">
                            {initials}
                          </div>
                          <div className="font-semibold">{s.name}</div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-fg-muted text-xs">{s.email}</td>
                      <td className="px-3.5 py-3">
                        <Badge tone={ROLE_TONE[s.role]}>{ROLE_LABELS[s.role]}</Badge>
                      </td>
                      <td className="px-3.5 py-3">
                        {s.twoFactor ? (
                          <span className="inline-flex items-center gap-1 text-xs text-success">
                            <ShieldCheck className="size-3.5" /> On
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-warning">
                            <Shield className="size-3.5" /> Off
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-xs text-fg-muted">{s.lastSeen}</td>
                      <td className="px-3.5 py-3">
                        <Badge tone={s.active ? "success" : "neutral"}>
                          {s.active ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <button
                          className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Permissions matrix */}
          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">Permissions matrix</div>
                <div className="text-xs text-fg-muted mt-0.5">
                  System roles cannot be deleted. Edits to permissions take effect immediately.
                </div>
              </div>
              <Button variant="secondary" size="sm">
                + New custom role
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 sticky top-0">
                  <tr>
                    <th className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                      Permission
                    </th>
                    {ROLES_LIST.map((r) => (
                      <th
                        key={r}
                        className="text-center px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted min-w-24"
                      >
                        {ROLE_LABELS[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((g) => (
                    <>
                      <tr key={g.group} className="bg-surface-2/50">
                        <td
                          colSpan={ROLES_LIST.length + 1}
                          className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-fg-muted"
                        >
                          {g.group}
                        </td>
                      </tr>
                      {g.rows.map((row) => (
                        <tr key={row.label} className="border-t border-border">
                          <td className="px-3.5 py-2.5 text-sm font-medium">{row.label}</td>
                          {ROLES_LIST.map((r) => (
                            <td key={r} className="text-center px-3 py-2.5">
                              {row.roles.includes(r) ? (
                                <Check className="size-4 text-success inline-block" strokeWidth={3} />
                              ) : (
                                <X className="size-4 text-fg-subtle inline-block" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
