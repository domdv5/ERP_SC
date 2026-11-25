-- CreateEnum
CREATE TYPE "ReciboCajaVoidReason" AS ENUM ('valor_equivocado', 'cliente_equivocado', 'factura_equivocada', 'forma_pago_equivocada', 'pago_duplicado', 'pago_no_recibido', 'otro');

-- AlterTable
ALTER TABLE "recibo_caja" ADD COLUMN     "void_reason" "ReciboCajaVoidReason",
ADD COLUMN     "void_reason_other" VARCHAR(500),
ADD COLUMN     "voided_at" TIMESTAMPTZ,
ADD COLUMN     "voided_by_id" UUID;

-- AddForeignKey
ALTER TABLE "recibo_caja" ADD CONSTRAINT "recibo_caja_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
