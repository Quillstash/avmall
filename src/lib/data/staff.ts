/**
 * Staff data layer. Lists users in the User table — never returns the
 * password hash or TOTP secret.
 */

import "server-only";

import { db, hasDatabase, withRetry } from "@/lib/db";
import {
  STAFF as MOCK_STAFF,
  type StaffMember,
} from "@/lib/admin-mock-data";

export type { StaffMember };

/** Human-readable "X minutes/hours/days ago" from a Date, or "Never". */
function timeAgo(d: Date | null): string {
  if (!d) return "Never";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Lagos",
  });
}

export async function listStaff(): Promise<StaffMember[]> {
  if (!hasDatabase) {
    return [...MOCK_STAFF];
  }
  const users = await withRetry(() =>
    db.user.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roleId: true,
        active: true,
        lastSeenAt: true,
        assignedRole: { select: { name: true } },
      },
    }),
  );
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as StaffMember["role"],
    roleId: u.roleId,
    roleName: u.assignedRole?.name ?? null,
    active: u.active,
    lastSeen: timeAgo(u.lastSeenAt),
  }));
}

export interface StaffInvitationView {
  id: string;
  email: string;
  name: string;
  role: string;
  roleName: string | null;
  status: "pending" | "accepted" | "expired";
  invitedBy: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

/** Outstanding + historical staff invitations with a derived status. */
export async function listStaffInvitations(): Promise<StaffInvitationView[]> {
  if (!hasDatabase) return [];
  const rows = await withRetry(() =>
    db.staffInvitation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        invitedBy: { select: { name: true } },
        assignedRole: { select: { name: true } },
      },
    }),
  );
  const now = Date.now();
  return rows.map((i) => ({
    id: i.id,
    email: i.email,
    name: i.name,
    role: i.role,
    roleName: i.assignedRole?.name ?? null,
    status: i.acceptedAt
      ? "accepted"
      : i.expiresAt.getTime() < now
        ? "expired"
        : "pending",
    invitedBy: i.invitedBy?.name ?? null,
    expiresAt: i.expiresAt.toISOString(),
    acceptedAt: i.acceptedAt ? i.acceptedAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
  }));
}
