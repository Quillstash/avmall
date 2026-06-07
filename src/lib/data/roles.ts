/**
 * Roles data layer (admin). Lists dynamic roles with their permission sets and
 * how many staff are assigned to each.
 */

import "server-only";
import { db, hasDatabase } from "@/lib/db";

export interface RoleView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export async function listRoles(): Promise<RoleView[]> {
  if (!hasDatabase) return [];
  const roles = await db.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    isSystem: r.isSystem,
    permissions: r.permissions,
    userCount: r._count.users,
  }));
}
