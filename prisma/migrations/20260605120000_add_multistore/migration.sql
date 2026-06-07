-- Multi-store foundation: per-store inventory + a store on staff / orders /
-- reservations. Existing single-store data is migrated into a "Main" store.
-- Hand-authored (not `migrate dev`) because it backfills data before dropping
-- the old global stock columns and before enforcing NOT NULL on a populated
-- table. DDL matches `prisma migrate diff` exactly so there is no drift.

-- 1. Stores
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- 2. Per-store stock table
CREATE TABLE "store_stock" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "store_stock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "store_stock_variant_id_idx" ON "store_stock"("variant_id");
CREATE UNIQUE INDEX "store_stock_store_id_variant_id_key" ON "store_stock"("store_id", "variant_id");

-- 3. Seed the Main store and migrate existing global stock into it.
INSERT INTO "stores" ("id", "name", "slug", "is_main", "active", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'Main Store', 'main', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "store_stock" ("id", "store_id", "variant_id", "on_hand", "reserved", "updated_at")
SELECT gen_random_uuid(),
       (SELECT "id" FROM "stores" WHERE "slug" = 'main'),
       v."id", v."on_hand", v."reserved", CURRENT_TIMESTAMP
FROM "product_variants" v;

-- 4. orders.store_id — add nullable, backfill existing orders to Main.
ALTER TABLE "orders" ADD COLUMN "store_id" UUID;
UPDATE "orders" SET "store_id" = (SELECT "id" FROM "stores" WHERE "slug" = 'main');
CREATE INDEX "orders_store_id_idx" ON "orders"("store_id");

-- 5. users.store_id — add nullable, backfill existing staff to Main.
ALTER TABLE "users" ADD COLUMN "store_id" UUID;
UPDATE "users" SET "store_id" = (SELECT "id" FROM "stores" WHERE "slug" = 'main');
CREATE INDEX "users_store_id_idx" ON "users"("store_id");

-- 6. stock_reservations.store_id — add nullable, backfill, then enforce NOT NULL.
ALTER TABLE "stock_reservations" ADD COLUMN "store_id" UUID;
UPDATE "stock_reservations" SET "store_id" = (SELECT "id" FROM "stores" WHERE "slug" = 'main');
ALTER TABLE "stock_reservations" ALTER COLUMN "store_id" SET NOT NULL;
CREATE INDEX "stock_reservations_store_id_variant_id_idx" ON "stock_reservations"("store_id", "variant_id");

-- 7. Drop the old global stock columns now that data has moved to store_stock.
ALTER TABLE "product_variants" DROP COLUMN "on_hand",
DROP COLUMN "reserved";

-- 8. Foreign keys
ALTER TABLE "store_stock" ADD CONSTRAINT "store_stock_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_stock" ADD CONSTRAINT "store_stock_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
