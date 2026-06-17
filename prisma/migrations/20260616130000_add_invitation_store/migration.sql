-- AlterTable
ALTER TABLE "staff_invitations" ADD COLUMN     "store_id" UUID;

-- CreateIndex
CREATE INDEX "staff_invitations_store_id_idx" ON "staff_invitations"("store_id");

-- AddForeignKey
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

