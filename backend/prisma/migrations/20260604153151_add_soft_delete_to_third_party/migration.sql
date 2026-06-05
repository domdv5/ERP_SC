-- AlterTable
ALTER TABLE "third_parties" ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "deleted_by_id" UUID;

-- AddForeignKey
ALTER TABLE "third_parties" ADD CONSTRAINT "third_parties_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
