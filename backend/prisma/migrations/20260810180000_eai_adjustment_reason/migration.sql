-- CreateEnum
CREATE TYPE "EaiAdjustmentReason" AS ENUM ('negativo', 'inventario_general', 'traspaso_costo', 'otro');

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "adjustment_reason" "EaiAdjustmentReason",
ADD COLUMN     "adjustment_reason_other" VARCHAR(300);
