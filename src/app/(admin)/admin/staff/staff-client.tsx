"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, ShieldCheck, Loader2, Mail } from "lucide-react";
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
import {
  PermissionMatrix,
  type PermissionGroup,
} from "@/components/admin/permission-matrix";
import { toast } from "@/components/ui/toaster";
import {
  ROLE_LABELS,
  type StaffMember,
  type StaffRole,
} from "@/lib/admin-mock-data";

interface StaffClientProps {
  initialStaff: StaffMember[];
}

const ROLE_TONE: Record<StaffRole, "brand" | "info" | "success" | "warning" | "neutral"> = {
  super_admin: "brand",
  manager: "info",
  sales: "success",
  inventory: "warning",
  support: "neutral",
};

const ROLES_LIST: StaffRole[] = ["super_admin", "manager", "sales", "inventory", "support"];

const PERMISSIONS: PermissionGroup[] = [
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

export function StaffClient({ initialStaff }: StaffClientProps) {
  const router = useRouter();
  const [staff, setStaff] = React.useState<StaffMember[]>(initialStaff);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  function toggle2FA(id: string, next: boolean) {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, twoFactor: next } : s)));
    toast.success(next ? "2FA enabled" : "2FA disabled");
  }

  function toggleActive(id: string, next: boolean) {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, active: next } : s)));
    toast.success(next ? "User reactivated" : "User disabled");
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
        <Badge tone={ROLE_TONE[row.original.role]}>{ROLE_LABELS[row.original.role]}</Badge>
      ),
    },
    {
      accessorKey: "twoFactor",
      header: "2FA",
      enableSorting: false,
      cell: ({ row }) => (
        <Switch
          checked={row.original.twoFactor}
          onCheckedChange={(v) => toggle2FA(row.original.id, v)}
        />
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
          onCheckedChange={(v) => toggleActive(row.original.id, v)}
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
              <DropdownMenuItem onClick={() => toast.success("Reset password email sent")}>
                Reset password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Profile opened")}>
                Edit profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onClick={() => toggleActive(row.original.id, !row.original.active)}
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
            subtitle={`${staff.length} staff members · ${ROLES_LIST.length} roles`}
            actions={
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <Plus className="size-3.5" /> Invite staff
              </Button>
            }
          />

          <DataTable columns={columns} data={staff} className="mb-6" />

          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-fg-muted" />
                <div>
                  <div className="text-sm font-bold">Permissions matrix</div>
                  <div className="text-xs text-fg-muted mt-0.5">
                    System roles cannot be deleted. Edits take effect immediately.
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm">
                <Plus className="size-3.5" /> New custom role
              </Button>
            </div>
            <PermissionMatrix groups={PERMISSIONS} roles={ROLES_LIST} />
          </div>
        </div>
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={() => router.refresh()}
      />
    </>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onInvited: () => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<StaffRole>("sales");
  const [submitting, setSubmitting] = React.useState(false);

  function reset() {
    setName("");
    setEmail("");
    setRole("sales");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not send invitation");
        return;
      }
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
              Send a one-time link by email so they can set their password and sign in.
              Links are valid for 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Field id="invite-name" label="Full name">
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Funmi Adesina"
                autoFocus
              />
            </Field>
            <Field id="invite-email" label="Work email">
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="funmi@avmall.ng"
              />
            </Field>
            <Field id="invite-role" label="Role">
              <Select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
              >
                <option value="super_admin">Super admin</option>
                <option value="manager">Manager</option>
                <option value="sales">Sales</option>
                <option value="inventory">Inventory</option>
                <option value="support">Support</option>
              </Select>
            </Field>
          </div>
          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
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
