-- AlterTable
ALTER TABLE "customer_credit" ADD COLUMN     "idempotency_key" VARCHAR(100);

-- AlterTable
ALTER TABLE "supplier_credit" ADD COLUMN     "idempotency_key" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_idempotency_key_key" ON "customer_credit"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_idempotency_key_key" ON "supplier_credit"("idempotency_key");
