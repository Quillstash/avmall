-- Couriers — managed live from the admin shipping tab (replaces the hard-coded
-- mock list). Additive: just a new table + a seed of the previous mock entries.

CREATE TABLE "couriers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "tracking_url" TEXT,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);

-- Seed the previously hard-coded couriers so the live section isn't empty.
INSERT INTO "couriers" ("id", "name", "active", "is_primary", "position", "updated_at") VALUES
  (gen_random_uuid(), 'GIG Logistics', true, true, 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Sendbox', true, false, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DHL (international)', false, false, 2, CURRENT_TIMESTAMP);
