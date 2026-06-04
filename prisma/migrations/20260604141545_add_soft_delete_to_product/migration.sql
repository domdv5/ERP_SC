-- AlterTable
ALTER TABLE "product" ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "deleted_by_id" UUID;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
