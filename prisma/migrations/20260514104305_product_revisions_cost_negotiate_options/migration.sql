-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "option1_value" TEXT,
ADD COLUMN     "option2_value" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "cost_price_kobo" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "negotiate_floor_kobo" BIGINT,
ADD COLUMN     "negotiate_max_pct" INTEGER,
ADD COLUMN     "option1_name" TEXT,
ADD COLUMN     "option2_name" TEXT;

-- CreateTable
CREATE TABLE "ai_settings" (
    "key" TEXT NOT NULL DEFAULT 'default',
    "global_negotiate_max_pct" INTEGER NOT NULL DEFAULT 10,
    "negotiation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("key")
);
