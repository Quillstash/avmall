"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  MoreHorizontal,
  Loader2,
  Mail,
  UserCog,
  Send,
  Trash2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, initialsOf } from "@/components/ui/avatar";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { useSession } from "next-auth/react";
import { RolesManager, type RoleView } from "./roles-manager";
import { hasPermission } from "@/lib/permissions";
import {
  ROLE_LABELS,
  type StaffMember,
  type StaffRole,
} from "@/lib/admin-mock-data";
import type { StaffInvitationView } from "@/lib/data/staff";

interface StaffClientProps {
  initialStaff: StaffMember[];
  initialInvitations: StaffInvitationView[];
  initialRoles: RoleView[];
}

const ROLE_TONE: Record<StaffRole, "brand" | "info" | "success" | "warning" | "neutral"> = {
  super_admin: "brand",
  manager: "info",
  sales: "success",
  inventory: "warning",
  support: "neutral",
};

function InviteStatusBadge({
  status,
}: {
  status: "pending" | "accepted" | "expired";
}) {
  if (status === "accepted") return <Badge tone="success">Accepted</Badge>;
  if (status === "expired") return <Badge tone="neutral">Expired</Badge>;
  return <Badge tone="warning">Pending</Badge>;
}

export function StaffClient({
  initialStaff,
  initialInvitations,
  initialRoles,
}: StaffClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const canManageRoles = session?.user
    ? hasPermission({ permissions: session.user.permissions }, "roles.manage")
    : false;
  const [staff, setStaff] = React.useState<StaffMember[]>(initialStaff);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<StaffMember | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [invBusyId, setInvBusyId] = React.useState<string | null>(null);

  const pendingInvites = initialInvitations.filter((i) => i.status === "pending").length;

  async function resendInvite(id: string, email: string) {
    setInvBusyId(id);
    try {
      const res = await fetch(`/api/v1/admin/staff/invitations/${id}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not resend invitation");
        return;
      }
      toast.success(
        json?.data?.email?.skipped
          ? `Invite reset for ${email} (email delivery skipped)`
          : `Invite re-sent to ${email}`,
      );
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setInvBusyId(null);
    }
  }

  async function revokeInvite(id: string, email: string) {
    if (!confirm(`Revoke the invitation for ${email}?`)) return;
    setInvBusyId(id);
    try {
      const res = await fetch(`/api/v1/admin/staff/invitations/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        toast.error(json?.error?.message ?? "Could not revoke invitation");
        return;
      }
      toast.success(`Invitation for ${email} revoked`);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setInvBusyId(null);
    }
  }

  async function sendPasswordReset(email: string) {
    try {
      await fetch("/api/v1/staff/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      toast.success(`Reset link sent to ${email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    }
  }

  async function toggleActive(member: StaffMember, next: boolean) {
    setTogglingId(member.id);
    try {
      const res = await fetch(`/api/v1/admin/staff/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      const json = await res.json();
      if (res.status === 404 || res.status === 503) {
        // Local/mock mode — update state only
        setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, active: next } : s)));
        toast.success(next ? "User reactivated" : "User disabled");
        return;
      }
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not update");
        return;
      }
      setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, active: next } : s)));
      toast.success(next ? `${member.name} reactivated` : `${member.name} disabled`);
    } catch {
      toast.error("Network error");
    } finally {
      setTogglingId(null);
    }
  }


  const columns: ColumnDef<StaffMember>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <Avatar size="sm">
            <AvatarFallback>{initialsOf(row.original.name)}</AvatarFallback>
          </Avatar>
          <div className="font-semibold">{row.original.name}</div>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-fg-muted text-xs">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge tone={ROLE_TONE[row.original.role]}>
          {row.original.roleName ?? ROLE_LABELS[row.original.role]}
        </Badge>
      ),
    },
    {
      accessorKey: "lastSeen",
      header: "Last seen",
      cell: ({ row }) => <span className="text-xs text-fg-muted">{row.original.lastSeen}</span>,
    },
    {
      accessorKey: "active",
      header: "Active",
      enableSorting: false,
      cell: ({ row }) => (
        <Switch
          checked={row.original.active}
          disabled={togglingId === row.original.id}
          onCheckedChange={(v) => toggleActive(row.original, v)}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface"
                aria-label="Row actions"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditTarget(row.original)}>
                <UserCog className="size-3.5" /> Change role
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => sendPasswordReset(row.original.email)}>
                <Mail className="size-3.5" /> Send password reset
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive={row.original.active}
                onClick={() => toggleActive(row.original, !row.original.active)}
                disabled={togglingId === row.original.id}
              >
                {row.original.active ? "Disable" : "Reactivate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "Staff & roles" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto pb-12">
          <PageHeader
            title="Staff & roles"
            subtitle={`${staff.length} staff · ${initialRoles.length} roles${
              pendingInvites > 0
                ? ` · ${pendingInvites} pending invite${pendingInvites === 1 ? "" : "s"}`
                : ""
            }`}
            actions={
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <Plus className="size-3.5" /> Invite staff
              </Button>
            }
          />

          <DataTable columns={columns} data={staff} className="mb-6" />

          {initialInvitations.length > 0 && (
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-sm font-bold">Invitations</div>
                <div className="text-xs text-fg-muted mt-0.5">
                  Pending and recent staff invites
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    <th className="text-left px-4 py-2.5">Invitee</th>
                    <th className="text-left px-4 py-2.5">Role</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                    <th className="text-left px-4 py-2.5">Invited</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {initialInvitations.map((inv) => (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{inv.name}</div>
                        <div className="text-[11px] text-fg-muted">{inv.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={ROLE_TONE[inv.role as StaffRole] ?? "neutral"}>
                          {inv.roleName ?? ROLE_LABELS[inv.role as StaffRole] ?? inv.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <InviteStatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-fg-muted">
                        {new Date(inv.createdAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "Africa/Lagos",
                        })}
                        {inv.invitedBy && (
                          <div className="text-[10px] text-fg-subtle">by {inv.invitedBy}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.status !== "accepted" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="p-1.5 text-fg-muted hover:text-fg rounded-md hover:bg-surface disabled:opacity-50"
                                disabled={invBusyId === inv.id}
                                aria-label={`Actions for ${inv.email}`}
                              >
                                {invBusyId === inv.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="size-4" />
                                )}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => resendInvite(inv.id, inv.email)}>
                                <Send className="size-3.5" /> Resend invite
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onClick={() => revokeInvite(inv.id, inv.email)}
                              >
                                <Trash2 className="size-3.5" /> Revoke
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <RolesManager roles={initialRoles} canManage={canManageRoles} />
        </div>
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        roles={initialRoles}
        onInvited={() => router.refresh()}
      />

      {editTarget && (
        <EditRoleDialog
          member={editTarget}
          roles={initialRoles}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function EditRoleDialog({
  member,
  roles,
  onClose,
  onSaved,
}: {
  member: StaffMember;
  roles: RoleView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roleId, setRoleId] = React.useState<string>(
    member.roleId ?? roles[0]?.id ?? "",
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!roleId || roleId === member.roleId) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/staff/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not update role");
        return;
      }
      const roleName = roles.find((r) => r.id === roleId)?.name ?? "role";
      toast.success(`${member.name}'s role changed to ${roleName}`);
      onSaved();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change role — {member.name}</DialogTitle>
          <DialogDescription>Takes effect immediately.</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <Field id="edit-role" label="Role">
            <Select
              id="edit-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <DialogFooter className="mt-5">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onInvited,
  roles,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onInvited: () => void;
  roles: RoleView[];
}) {
  const defaultRoleId = roles.find((r) => r.slug === "sales")?.id ?? roles[0]?.id ?? "";
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [roleId, setRoleId] = React.useState<string>(defaultRoleId);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open && !roleId) setRoleId(defaultRoleId);
  }, [open, roleId, defaultRoleId]);

  function reset() {
    setName("");
    setEmail("");
    setRoleId(defaultRoleId);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { toast.error("Name and email are required."); return; }
    if (!roleId) { toast.error("Pick a role."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), roleId }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json?.error?.message ?? "Could not send invitation"); return; }
      const skipped = json?.data?.email?.skipped;
      toast.success(
        skipped
          ? `Invitation created for ${email} (email skipped — RESEND_API_KEY not set)`
          : `Invitation sent to ${email}`,
      );
      reset();
      onOpenChange(false);
      onInvited();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Invite staff</DialogTitle>
            <DialogDescription>
              Send a one-time link so they can set their password and sign in. Valid 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Field id="invite-name" label="Full name">
              <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Funmi Adesina" autoFocus />
            </Field>
            <Field id="invite-email" label="Work email">
              <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="funmi@avmall.ng" />
            </Field>
            <Field id="invite-role" label="Role">
              <Select id="invite-role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              <Mail className="size-4" /> Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
