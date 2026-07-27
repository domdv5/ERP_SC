-- AlterTable
ALTER TABLE "document" ADD COLUMN     "confirmed_by_id" UUID,
ADD COLUMN     "voided_by_id" UUID;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
