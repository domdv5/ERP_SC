-- AlterTable
ALTER TABLE "recibo_caja" ADD COLUMN     "customer_branch_id" UUID;

-- CreateIndex
CREATE INDEX "recibo_caja_customer_branch_id_idx" ON "recibo_caja"("customer_branch_id");

-- AddForeignKey
ALTER TABLE "recibo_caja" ADD CONSTRAINT "recibo_caja_customer_branch_id_fkey" FOREIGN KEY ("customer_branch_id") REFERENCES "customer_branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
