-- CreateEnum
CREATE TYPE "ReciboCajaDiscountReason" AS ENUM ('descuento_comercial', 'oferta', 'donacion', 'fidelizacion', 'mercancia_extraviada', 'castigo_cartera', 'promocion');

-- AlterTable
ALTER TABLE "recibo_caja" ADD COLUMN     "debt_before_receipt" DECIMAL(16,2),
ADD COLUMN     "discount_amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_reason" "ReciboCajaDiscountReason";

-- AlterTable
ALTER TABLE "recibo_caja_allocation" ADD COLUMN     "discount_amount" DECIMAL(16,2) NOT NULL DEFAULT 0;

-- Castigo de cartera / mercancía extraviada saldan sin dinero: total puede ser 0.
ALTER TABLE "recibo_caja" DROP CONSTRAINT "recibo_caja_total_chk";
ALTER TABLE "recibo_caja" ADD CONSTRAINT "recibo_caja_total_chk" CHECK ("total" >= 0);

ALTER TABLE "recibo_caja" ADD CONSTRAINT "recibo_caja_discount_chk" CHECK (
  "discount_amount" >= 0
  AND ("discount_amount" = 0) = ("discount_reason" IS NULL)
);

ALTER TABLE "recibo_caja_allocation" ADD CONSTRAINT "recibo_caja_allocation_discount_chk"
  CHECK ("discount_amount" >= 0 AND "discount_amount" <= "amount");
