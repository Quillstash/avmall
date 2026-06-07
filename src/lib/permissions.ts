/**
 * Server-side permission checks. UI guards in /admin only hide what a user
 * can't see — these are the authoritative checks. Every API route that
 * mutates state runs `requirePermission(session, "orders.cancel")` etc.
 *
 * See CLAUDE.md §2.5 + §8 + Appendix C.
 */

import type { StaffRole } from "@prisma/client";
import { ForbiddenError } from "./errors";

export type PermissionKey =
  // Orders
  | "orders.view"
  | "orders.create"
  | "orders.edit"
  | "orders.cancel"
  | "orders.apply_manual_discount"
  | "orders.override_partial_paid"
  // Products
  | "products.view"
  | "products.create"
  | "products.edit"
  | "products.edit_pricing"
  | "products.delete"
  | "products.stock_adjust"
  // Customers
  | "customers.view"
  | "customers.edit"
  | "customers.blacklist"
  // Discounts
  | "discounts.view"
  | "discounts.create"
  | "discounts.edit"
  | "discounts.delete"
  // Shipping
  | "shipping.view"
  | "shipping.edit"
  // Stores
  | "stores.view"
  | "stores.create"
  | "stores.edit"
  // Cross-store visibility — without it a staff member is scoped to their store
  | "stores.view_all"
  // Returns
  | "returns.view"
  | "returns.create"
  | "returns.approve"
  | "returns.refund"
  // Staff
  | "staff.view"
  | "staff.create"
  | "staff.edit"
  | "staff.disable"
  // Roles
  | "roles.view"
  | "roles.manage"
  // Reports
  | "reports.view"
  | "reports.export"
  // AI
  | "ai.view"
  | "ai.settings"
  | "ai.handoff"
  // Settings
  | "settings.view"
  | "settings.edit"
  | "billing.view";

/**
 * Static role → permission map. Source of truth seeded into the DB and
 * mirrored here for fast in-process checks.
 */
const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<PermissionKey>> = {
  super_admin: new Set<PermissionKey>([
    "orders.view", "orders.create", "orders.edit", "orders.cancel",
    "orders.apply_manual_discount", "orders.override_partial_paid",
    "products.view", "products.create", "products.edit", "products.edit_pricing",
    "products.delete", "products.stock_adjust",
    "customers.view", "customers.edit", "customers.blacklist",
    "discounts.view", "discounts.create", "discounts.edit", "discounts.delete",
    "shipping.view", "shipping.edit",
    "stores.view", "stores.create", "stores.edit", "stores.view_all",
    "returns.view", "returns.create", "returns.approve", "returns.refund",
    "staff.view", "staff.create", "staff.edit", "staff.disable",
    "roles.view", "roles.manage",
    "reports.view", "reports.export",
    "ai.view", "ai.settings", "ai.handoff",
    "settings.view", "settings.edit", "billing.view",
  ]),
  manager: new Set<PermissionKey>([
    "orders.view", "orders.create", "orders.edit", "orders.cancel",
    "orders.apply_manual_discount", "orders.override_partial_paid",
    "products.view", "products.create", "products.edit", "products.edit_pricing",
    "products.stock_adjust",
    "customers.view", "customers.edit", "customers.blacklist",
    "discounts.view", "discounts.create", "discounts.edit", "discounts.delete",
    "shipping.view", "shipping.edit",
    "stores.view", "stores.create", "stores.edit", "stores.view_all",
    "returns.view", "returns.create", "returns.approve", "returns.refund",
    "staff.view", "staff.create", "staff.edit", "staff.disable",
    "roles.view", "roles.manage",
    "reports.view", "reports.export",
    "ai.view", "ai.settings", "ai.handoff",
    "settings.view", "settings.edit",
  ]),
  sales: new Set<PermissionKey>([
    "orders.view", "orders.create", "orders.edit",
    "products.view",
    "customers.view", "customers.edit",
    "discounts.view",
    "returns.view", "returns.create",
    "ai.view", "ai.handoff",
    "reports.view",
  ]),
  inventory: new Set<PermissionKey>([
    "products.view", "products.edit", "products.stock_adjust",
    "orders.view",
    "shipping.view",
    "reports.view",
  ]),
  support: new Set<PermissionKey>([
    "orders.view", "orders.edit",
    "products.view",
    "customers.view", "customers.edit",
    "returns.view", "returns.create", "returns.approve",
    "ai.view", "ai.handoff",
  ]),
};

export interface StaffSession {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
  /** Resolved permission keys (from the user's dynamic Role). */
  permissions?: readonly string[];
}

/**
 * Authoritative permission check. Prefers the session's resolved permission
 * list (dynamic role); falls back to the static map for the legacy enum role
 * when no list is present (e.g. a user with no roleId).
 */
export function hasPermission(
  session: { role?: StaffRole; permissions?: readonly string[] },
  permission: PermissionKey,
): boolean {
  if (session.permissions) return session.permissions.includes(permission);
  if (session.role) return ROLE_PERMISSIONS[session.role].has(permission);
  return false;
}

/** Throws ForbiddenError if the session lacks the permission. */
export function requirePermission(
  session: { role?: StaffRole; permissions?: readonly string[] },
  permission: PermissionKey,
): void {
  if (!hasPermission(session, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}

/** Static (system-role) permissions — used to seed system roles + as fallback. */
export function permissionsForRole(role: StaffRole): PermissionKey[] {
  return Array.from(ROLE_PERMISSIONS[role]);
}

const ENUM_ROLES: readonly string[] = [
  "super_admin",
  "manager",
  "sales",
  "inventory",
  "support",
];

/**
 * Map a dynamic role slug to the legacy enum: the matching enum for a system
 * role, else "support" (least-privilege) as a vestigial fallback — permissions
 * always come from the dynamic role, so the enum only matters if roleId is lost.
 */
export function enumForSlug(slug: string): StaffRole {
  return (ENUM_ROLES.includes(slug) ? slug : "support") as StaffRole;
}

/**
 * Grouped + labelled catalogue of every assignable permission. Drives the
 * role editor in the admin UI.
 */
export interface PermissionCatalogGroup {
  group: string;
  perms: { key: PermissionKey; label: string }[];
}

export const PERMISSION_CATALOG: PermissionCatalogGroup[] = [
  {
    group: "Orders",
    perms: [
      { key: "orders.view", label: "View orders" },
      { key: "orders.create", label: "Create orders" },
      { key: "orders.edit", label: "Edit orders" },
      { key: "orders.cancel", label: "Cancel orders" },
      { key: "orders.apply_manual_discount", label: "Apply manual discount" },
      { key: "orders.override_partial_paid", label: "Override partial-paid → ship" },
    ],
  },
  {
    group: "Products",
    perms: [
      { key: "products.view", label: "View products" },
      { key: "products.create", label: "Create products" },
      { key: "products.edit", label: "Edit products" },
      { key: "products.edit_pricing", label: "Edit pricing" },
      { key: "products.delete", label: "Delete products" },
      { key: "products.stock_adjust", label: "Adjust stock" },
    ],
  },
  {
    group: "Customers",
    perms: [
      { key: "customers.view", label: "View customers" },
      { key: "customers.edit", label: "Edit customers" },
      { key: "customers.blacklist", label: "Blacklist customers" },
    ],
  },
  {
    group: "Discounts",
    perms: [
      { key: "discounts.view", label: "View discounts" },
      { key: "discounts.create", label: "Create discounts" },
      { key: "discounts.edit", label: "Edit discounts" },
      { key: "discounts.delete", label: "Delete discounts" },
    ],
  },
  {
    group: "Shipping & stores",
    perms: [
      { key: "shipping.view", label: "View shipping" },
      { key: "shipping.edit", label: "Edit shipping + couriers" },
      { key: "stores.view", label: "View stores" },
      { key: "stores.create", label: "Create stores" },
      { key: "stores.edit", label: "Edit stores" },
      { key: "stores.view_all", label: "See all stores (cross-store)" },
    ],
  },
  {
    group: "Returns",
    perms: [
      { key: "returns.view", label: "View returns" },
      { key: "returns.create", label: "Create returns" },
      { key: "returns.approve", label: "Approve returns" },
      { key: "returns.refund", label: "Issue refunds" },
    ],
  },
  {
    group: "Staff & roles",
    perms: [
      { key: "staff.view", label: "View staff" },
      { key: "staff.create", label: "Invite staff" },
      { key: "staff.edit", label: "Edit staff" },
      { key: "staff.disable", label: "Disable staff" },
      { key: "roles.view", label: "View roles" },
      { key: "roles.manage", label: "Create / edit roles" },
    ],
  },
  {
    group: "Reports & AI",
    perms: [
      { key: "reports.view", label: "View reports" },
      { key: "reports.export", label: "Export reports" },
      { key: "ai.view", label: "View AI agent" },
      { key: "ai.settings", label: "AI settings" },
      { key: "ai.handoff", label: "AI handoff" },
    ],
  },
  {
    group: "Settings",
    perms: [
      { key: "settings.view", label: "View settings" },
      { key: "settings.edit", label: "Edit settings" },
      { key: "billing.view", label: "View billing" },
    ],
  },
];

/** Every assignable permission key (flattened from the catalogue). */
export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_CATALOG.flatMap((g) =>
  g.perms.map((p) => p.key),
);

const VALID_PERMISSION_KEYS = new Set<string>(ALL_PERMISSIONS);

/** Keep only known permission keys, de-duped — sanitises role editor input. */
export function cleanPermissions(perms: string[]): PermissionKey[] {
  return Array.from(
    new Set(perms.filter((p): p is PermissionKey => VALID_PERMISSION_KEYS.has(p))),
  );
}
