-- AlterTable
ALTER TABLE "egreso" ADD COLUMN     "void_reason" VARCHAR(500),
ADD COLUMN     "voided_at" TIMESTAMPTZ,
ADD COLUMN     "voided_by_id" UUID;

-- AddForeignKey
ALTER TABLE "egreso" ADD CONSTRAINT "egreso_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
