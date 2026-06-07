-- Dynamic RBAC. Additive + safe: a `roles` table seeded with the 5 system
-- roles (their current static permission sets), plus nullable role_id on users
-- and staff_invitations, backfilled from the legacy role enum. The enum stays
-- as a fallback — nothing is dropped.

-- 1. roles table
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");

-- 2. Seed the system roles with their current permissions.
INSERT INTO "roles" ("id","name","slug","description","is_system","permissions","updated_at") VALUES
  (gen_random_uuid(), 'Super admin', 'super_admin', 'Full access including billing.', true,
   ARRAY['orders.view','orders.create','orders.edit','orders.cancel','orders.apply_manual_discount','orders.override_partial_paid','products.view','products.create','products.edit','products.edit_pricing','products.delete','products.stock_adjust','customers.view','customers.edit','customers.blacklist','discounts.view','discounts.create','discounts.edit','discounts.delete','shipping.view','shipping.edit','stores.view','stores.create','stores.edit','stores.view_all','returns.view','returns.create','returns.approve','returns.refund','staff.view','staff.create','staff.edit','staff.disable','roles.view','roles.manage','reports.view','reports.export','ai.view','ai.settings','ai.handoff','settings.view','settings.edit','billing.view'],
   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Manager', 'manager', 'All operations except billing.', true,
   ARRAY['orders.view','orders.create','orders.edit','orders.cancel','orders.apply_manual_discount','orders.override_partial_paid','products.view','products.create','products.edit','products.edit_pricing','products.stock_adjust','customers.view','customers.edit','customers.blacklist','discounts.view','discounts.create','discounts.edit','discounts.delete','shipping.view','shipping.edit','stores.view','stores.create','stores.edit','stores.view_all','returns.view','returns.create','returns.approve','returns.refund','staff.view','staff.create','staff.edit','staff.disable','roles.view','roles.manage','reports.view','reports.export','ai.view','ai.settings','ai.handoff','settings.view','settings.edit'],
   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Sales', 'sales', 'Create orders + serve customers.', true,
   ARRAY['orders.view','orders.create','orders.edit','products.view','customers.view','customers.edit','discounts.view','returns.view','returns.create','ai.view','ai.handoff','reports.view'],
   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Inventory', 'inventory', 'Manage products + stock.', true,
   ARRAY['products.view','products.edit','products.stock_adjust','orders.view','shipping.view','reports.view'],
   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Support', 'support', 'Handle orders, customers + returns.', true,
   ARRAY['orders.view','orders.edit','products.view','customers.view','customers.edit','returns.view','returns.create','returns.approve','ai.view','ai.handoff'],
   CURRENT_TIMESTAMP);

-- 3. role_id columns
ALTER TABLE "users" ADD COLUMN "role_id" UUID;
ALTER TABLE "staff_invitations" ADD COLUMN "role_id" UUID;

-- 4. Backfill role_id from the enum (enum value == role slug).
UPDATE "users" u SET "role_id" = r."id" FROM "roles" r WHERE r."slug" = u."role"::text;
UPDATE "staff_invitations" si SET "role_id" = r."id" FROM "roles" r WHERE r."slug" = si."role"::text;

-- 5. Indexes + foreign keys
CREATE INDEX "users_role_id_idx" ON "users"("role_id");
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
