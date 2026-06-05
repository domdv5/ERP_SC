/*
  Warnings:

  - Made the column `internal_number` on table `suppliers` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "internal_number" SET NOT NULL;
