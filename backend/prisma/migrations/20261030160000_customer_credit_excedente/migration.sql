-- CreateEnum
CREATE TYPE "CustomerCreditKind" AS ENUM ('devolucion', 'excedente');
-- AlterTable
ALTER TABLE "customer_credit" ADD COLUMN     "customer_branch_id" UUID,
ADD COLUMN     "date" DATE,
ADD COLUMN     "kind" "CustomerCreditKind" NOT NULL DEFAULT 'devolucion',
ADD COLUMN     "user_id" UUID,
ADD COLUMN     "voided_at" TIMESTAMPTZ,
ADD COLUMN     "voided_by_id" UUID;
-- AlterTable
ALTER TABLE "customer_credit_application" ADD COLUMN     "recibo_caja_id" UUID,
ALTER COLUMN "sale_document_id" DROP NOT NULL;
-- CreateIndex
CREATE INDEX "customer_credit_customer_branch_id_idx" ON "customer_credit"("customer_branch_id");
-- CreateIndex
CREATE INDEX "customer_credit_application_recibo_caja_id_idx" ON "customer_credit_application"("recibo_caja_id");
-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_application_customer_credit_id_recibo_caja__key" ON "customer_credit_application"("customer_credit_id", "recibo_caja_id");
-- AddForeignKey
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_customer_branch_id_fkey" FOREIGN KEY ("customer_branch_id") REFERENCES "customer_branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "customer_credit_application" ADD CONSTRAINT "customer_credit_application_recibo_caja_id_fkey" FOREIGN KEY ("recibo_caja_id") REFERENCES "recibo_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cada aplicación va a una venta o a un recibo de caja, nunca a ambos ni a ninguno.
ALTER TABLE "customer_credit_application" ADD CONSTRAINT "customer_credit_application_target_chk"
  CHECK (("sale_document_id" IS NULL) <> ("recibo_caja_id" IS NULL));

-- Un excedente siempre registra quién y cuándo; voided solo con fecha y usuario de anulación.
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_excedente_chk"
  CHECK ("kind" <> 'excedente' OR ("user_id" IS NOT NULL AND "date" IS NOT NULL AND "source_document_id" IS NULL));
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_voided_chk"
  CHECK (("status" = 'voided') = ("voided_at" IS NOT NULL AND "voided_by_id" IS NOT NULL));
