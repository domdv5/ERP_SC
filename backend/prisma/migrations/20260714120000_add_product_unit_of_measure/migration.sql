-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('unidad', 'docena');

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "unit_of_measure" "UnitOfMeasure" NOT NULL DEFAULT 'unidad';
