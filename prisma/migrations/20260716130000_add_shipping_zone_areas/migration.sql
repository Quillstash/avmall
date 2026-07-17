-- Sub-state (LGA-level) delivery pricing. An area row prices a specific LGA via
-- a zone, overriding that state's whole-state zone. UNIQUE(state, lga) makes
-- overlaps impossible — each LGA has at most one price.
CREATE TABLE "shipping_zone_areas" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "state" TEXT NOT NULL,
    "lga" TEXT NOT NULL,
    CONSTRAINT "shipping_zone_areas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipping_zone_areas_state_lga_key" ON "shipping_zone_areas"("state", "lga");
CREATE INDEX "shipping_zone_areas_zone_id_idx" ON "shipping_zone_areas"("zone_id");

ALTER TABLE "shipping_zone_areas"
    ADD CONSTRAINT "shipping_zone_areas_zone_id_fkey"
    FOREIGN KEY ("zone_id") REFERENCES "shipping_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
