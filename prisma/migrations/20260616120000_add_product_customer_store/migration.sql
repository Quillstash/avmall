-- Per-store isolation for products + customers. Existing rows backfill to the
-- Main store. Customer phone uniqueness moves from global to per-store, so the
-- same person can exist independently in two stores.

-- ── products.store_id ──────────────────────────────────────────────
ALTER TABLE "products" ADD COLUMN "store_id" UUID;
UPDATE "products" SET "store_id" = (SELECT id FROM "stores" WHERE is_main = true LIMIT 1);
ALTER TABLE "products" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "products_store_id_idx" ON "products"("store_id");

-- ── customers.store_id + per-store phone uniqueness ────────────────
ALTER TABLE "customers" ADD COLUMN "store_id" UUID;
UPDATE "customers" SET "store_id" = (SELECT id FROM "stores" WHERE is_main = true LIMIT 1);
ALTER TABLE "customers" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "customers_phone_key";
CREATE INDEX "customers_store_id_idx" ON "customers"("store_id");
CREATE UNIQUE INDEX "customers_store_id_phone_key" ON "customers"("store_id", "phone");
