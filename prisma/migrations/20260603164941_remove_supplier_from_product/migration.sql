/*
  Warnings:

  - You are about to drop the column `supplier_id` on the `product` table. All the data in the column will be lost.
  - Made the column `supplier_id` on table `brand` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "brand" DROP CONSTRAINT "brand_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "product" DROP CONSTRAINT "product_supplier_id_fkey";

-- AlterTable
ALTER TABLE "brand" ALTER COLUMN "supplier_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "product" DROP COLUMN "supplier_id";

-- AddForeignKey
ALTER TABLE "brand" ADD CONSTRAINT "brand_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
