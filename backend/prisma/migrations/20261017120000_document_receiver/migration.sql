-- AlterTable
ALTER TABLE "document" ADD COLUMN     "receiver_id" UUID;

-- AlterTable
ALTER TABLE "third_parties" ADD COLUMN     "is_receiver" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "third_parties_is_receiver_idx" ON "third_parties"("is_receiver");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "third_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
