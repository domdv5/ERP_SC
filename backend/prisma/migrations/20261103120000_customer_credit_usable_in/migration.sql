-- CreateEnum
CREATE TYPE "CustomerCreditUsableIn" AS ENUM ('facturacion', 'administracion');
-- AlterTable
ALTER TABLE "customer_credit" ADD COLUMN     "usable_in" "CustomerCreditUsableIn" NOT NULL DEFAULT 'facturacion';
-- AlterTable
ALTER TABLE "document" ADD COLUMN     "credit_usable_in" "CustomerCreditUsableIn";

-- Los excedentes ya existentes solo se usaban en recibos de caja.
UPDATE "customer_credit" SET "usable_in" = 'administracion' WHERE "kind" = 'excedente';

-- Un excedente siempre se usa en administración.
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_excedente_usable_in_chk"
  CHECK ("kind" <> 'excedente' OR "usable_in" = 'administracion');
