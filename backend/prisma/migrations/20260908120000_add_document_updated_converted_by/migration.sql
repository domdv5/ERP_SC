-- AlterTable
ALTER TABLE "document" ADD COLUMN     "converted_at" TIMESTAMPTZ,
ADD COLUMN     "converted_by_id" UUID,
ADD COLUMN     "updated_by_id" UUID;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_converted_by_id_fkey" FOREIGN KEY ("converted_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
