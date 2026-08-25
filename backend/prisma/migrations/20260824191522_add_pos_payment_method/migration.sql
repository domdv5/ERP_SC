-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('efectivo', 'tarjeta', 'transferencia');

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "payment_method" "PaymentMethod";
