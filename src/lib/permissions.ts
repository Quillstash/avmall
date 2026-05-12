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
  | "customers.store_credit"
  // Discounts
  | "discounts.view"
  | "discounts.create"
  | "discounts.edit"
  | "discounts.delete"
  // Shipping
  | "shipping.view"
  | "shipping.edit"
  // Returns
  | "returns.view"
  | "returns.approve"
  | "returns.refund"
  // Staff
  | "staff.view"
  | "staff.create"
  | "staff.edit"
  | "staff.disable"
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
    "customers.view", "customers.edit", "customers.blacklist", "customers.store_credit",
    "discounts.view", "discounts.create", "discounts.edit", "discounts.delete",
    "shipping.view", "shipping.edit",
    "returns.view", "returns.approve", "returns.refund",
    "staff.view", "staff.create", "staff.edit", "staff.disable",
    "reports.view", "reports.export",
    "ai.view", "ai.settings", "ai.handoff",
    "settings.view", "settings.edit", "billing.view",
  ]),
  manager: new Set<PermissionKey>([
    "orders.view", "orders.create", "orders.edit", "orders.cancel",
    "orders.apply_manual_discount", "orders.override_partial_paid",
    "products.view", "products.create", "products.edit", "products.edit_pricing",
    "products.stock_adjust",
    "customers.view", "customers.edit", "customers.blacklist", "customers.store_credit",
    "discounts.view", "discounts.create", "discounts.edit", "discounts.delete",
    "shipping.view", "shipping.edit",
    "returns.view", "returns.approve", "returns.refund",
    "staff.view", "staff.create", "staff.edit", "staff.disable",
    "reports.view", "reports.export",
    "ai.view", "ai.settings", "ai.handoff",
    "settings.view", "settings.edit",
  ]),
  sales: new Set<PermissionKey>([
    "orders.view", "orders.create", "orders.edit",
    "products.view",
    "customers.view", "customers.edit",
    "discounts.view",
    "returns.view",
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
    "customers.view", "customers.edit", "customers.store_credit",
    "returns.view", "returns.approve",
    "ai.view", "ai.handoff",
  ]),
};

export interface StaffSession {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
}

export function hasPermission(
  session: Pick<StaffSession, "role">,
  permission: PermissionKey,
): boolean {
  return ROLE_PERMISSIONS[session.role].has(permission);
}

/** Throws ForbiddenError if the session lacks the permission. */
export function requirePermission(
  session: Pick<StaffSession, "role">,
  permission: PermissionKey,
): void {
  if (!hasPermission(session, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}

/** All permissions for a role — useful for the UI matrix. */
export function permissionsForRole(role: StaffRole): PermissionKey[] {
  return Array.from(ROLE_PERMISSIONS[role]);
}
