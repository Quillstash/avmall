-- CreateTable
CREATE TABLE "bumpa_sales_snapshots" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "period_key" TEXT NOT NULL,
    "period_from" TIMESTAMPTZ NOT NULL,
    "period_to" TIMESTAMPTZ NOT NULL,
    "total_sales_kobo" BIGINT NOT NULL,
    "offline_sales_kobo" BIGINT NOT NULL,
    "settled_kobo" BIGINT NOT NULL,
    "owed_kobo" BIGINT NOT NULL,
    "channels" JSONB NOT NULL,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bumpa_sales_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bumpa_sales_snapshots_store_id_period_key_key" ON "bumpa_sales_snapshots"("store_id", "period_key");

-- AddForeignKey
ALTER TABLE "bumpa_sales_snapshots" ADD CONSTRAINT "bumpa_sales_snapshots_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
