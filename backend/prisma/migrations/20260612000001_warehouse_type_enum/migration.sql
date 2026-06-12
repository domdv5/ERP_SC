-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('store', 'warehouse');

-- AlterTable
ALTER TABLE "warehouse" DROP COLUMN "type",
ADD COLUMN     "type" "WarehouseType" NOT NULL;
