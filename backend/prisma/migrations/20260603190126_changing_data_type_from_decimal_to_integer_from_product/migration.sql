/*
  Warnings:

  - You are about to alter the column `sale_price` on the `product` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,2)` to `Integer`.
  - You are about to alter the column `min_sale_price` on the `product` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,2)` to `Integer`.
  - You are about to alter the column `stock_cache` on the `product` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,3)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "product" ALTER COLUMN "sale_price" SET DATA TYPE INTEGER,
ALTER COLUMN "min_sale_price" SET DATA TYPE INTEGER,
ALTER COLUMN "stock_cache" SET DEFAULT 0,
ALTER COLUMN "stock_cache" SET DATA TYPE INTEGER;
