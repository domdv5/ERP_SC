-- DropForeignKey
ALTER TABLE "customer_credit" DROP CONSTRAINT "customer_credit_source_document_id_fkey";

-- DropForeignKey
ALTER TABLE "customer_credit" DROP CONSTRAINT "customer_credit_third_party_id_fkey";

-- DropTable
DROP TABLE "customer_credit";

-- CreateIndex
CREATE INDEX "supplier_credit_application_supplier_credit_id_idx" ON "supplier_credit_application"("supplier_credit_id");
