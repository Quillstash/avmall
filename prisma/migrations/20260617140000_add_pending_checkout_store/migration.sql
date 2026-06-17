-- AlterTable
ALTER TABLE "pending_checkouts" ADD COLUMN     "store_id" UUID;

-- CreateIndex
CREATE INDEX "pending_checkouts_store_id_idx" ON "pending_checkouts"("store_id");

-- AddForeignKey
ALTER TABLE "pending_checkouts" ADD CONSTRAINT "pending_checkouts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

