-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('purchase', 'sale', 'return', 'transfer', 'adjustment', 'initial_stock', 'void', 'production');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CM', 'DVC', 'RMDVC', 'PE', 'EAI', 'SAJ', 'COT', 'POS', 'REM', 'DVV', 'T');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'confirmed', 'voided');

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "dest_bin_id" UUID,
ADD COLUMN     "dest_warehouse_id" UUID,
ADD COLUMN     "warehouse_id" UUID,
DROP COLUMN "type",
ADD COLUMN     "type" "DocumentType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "inventory_movements" DROP COLUMN "movement_type",
ADD COLUMN     "movement_type" "MovementType" NOT NULL;

-- CreateIndex
CREATE INDEX "document_type_status_idx" ON "document"("type", "status");

-- CreateIndex
CREATE INDEX "document_date_idx" ON "document"("date");

-- CreateIndex
CREATE INDEX "document_third_party_id_idx" ON "document"("third_party_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_type_number_key" ON "document"("type", "number");

-- CreateIndex
CREATE INDEX "inventory_movements_movement_type_idx" ON "inventory_movements"("movement_type");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_dest_warehouse_id_fkey" FOREIGN KEY ("dest_warehouse_id") REFERENCES "warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_dest_bin_id_fkey" FOREIGN KEY ("dest_bin_id") REFERENCES "bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
