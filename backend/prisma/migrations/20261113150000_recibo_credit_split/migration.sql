-- DropIndex
DROP INDEX "customer_credit_application_customer_credit_id_recibo_caja__key";

-- AlterTable
ALTER TABLE "customer_credit_application" ADD COLUMN     "account_receivable_id" UUID;

-- AlterTable
ALTER TABLE "recibo_caja_allocation" ADD COLUMN     "credit_amount" DECIMAL(16,2);

-- CreateIndex
CREATE INDEX "customer_credit_application_account_receivable_id_idx" ON "customer_credit_application"("account_receivable_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_application_customer_credit_id_recibo_caja__key" ON "customer_credit_application"("customer_credit_id", "recibo_caja_id", "account_receivable_id");

-- AddForeignKey
ALTER TABLE "customer_credit_application" ADD CONSTRAINT "customer_credit_application_account_receivable_id_fkey" FOREIGN KEY ("account_receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK a mano: null en recibos viejos; el saldo usado nunca supera el abono
ALTER TABLE "recibo_caja_allocation" ADD CONSTRAINT "recibo_caja_allocation_credit_amount_chk"
  CHECK ("credit_amount" IS NULL OR ("credit_amount" >= 0 AND "credit_amount" <= "amount"));
