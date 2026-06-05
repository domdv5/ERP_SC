-- AlterTable
ALTER TABLE "third_parties" ADD COLUMN     "is_customer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_supplier" BOOLEAN NOT NULL DEFAULT false;
