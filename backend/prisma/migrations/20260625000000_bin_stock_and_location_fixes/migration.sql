-- DropForeignKey
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_bin_id_fkey";

-- DropIndex
DROP INDEX "bin_code_key";

-- DropIndex
DROP INDEX "zone_name_key";

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "source_bin_id" UUID;

-- AlterTable
ALTER TABLE "inventory" DROP COLUMN "bin_id";

-- CreateTable
CREATE TABLE "bin_stock" (
    "product_id" UUID NOT NULL,
    "bin_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bin_stock_pkey" PRIMARY KEY ("product_id","bin_id")
);

-- CreateIndex
CREATE INDEX "bin_stock_bin_id_idx" ON "bin_stock"("bin_id");

-- CreateIndex
CREATE INDEX "bin_stock_warehouse_id_product_id_idx" ON "bin_stock"("warehouse_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "bin_zone_id_code_key" ON "bin"("zone_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "zone_warehouse_id_name_key" ON "zone"("warehouse_id", "name");

-- AddForeignKey
ALTER TABLE "bin_stock" ADD CONSTRAINT "bin_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_stock" ADD CONSTRAINT "bin_stock_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_stock" ADD CONSTRAINT "bin_stock_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_source_bin_id_fkey" FOREIGN KEY ("source_bin_id") REFERENCES "bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
