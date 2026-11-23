-- S4: estado de saldos a favor como enum, conservando los datos
CREATE TYPE "CreditStatus" AS ENUM ('available', 'used', 'voided');

ALTER TABLE "customer_credit" DROP CONSTRAINT "customer_credit_voided_chk";

ALTER TABLE "customer_credit" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "customer_credit" ALTER COLUMN "status" TYPE "CreditStatus" USING "status"::"CreditStatus";
ALTER TABLE "customer_credit" ALTER COLUMN "status" SET DEFAULT 'available';

ALTER TABLE "supplier_credit" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "supplier_credit" ALTER COLUMN "status" TYPE "CreditStatus" USING "status"::"CreditStatus";
ALTER TABLE "supplier_credit" ALTER COLUMN "status" SET DEFAULT 'available';

ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_voided_chk"
  CHECK (("status" = 'voided') = ("voided_at" IS NOT NULL AND "voided_by_id" IS NOT NULL));

-- S3: índice del kardex por ítem; product_id solo ya lo cubre (product_id, created_at)
DROP INDEX "inventory_movements_product_id_idx";
CREATE INDEX "inventory_movements_document_item_id_idx" ON "inventory_movements"("document_item_id");

-- S1: no borrar historia (SET NULL -> RESTRICT)
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_document_id_fkey";
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_document_item_id_fkey";
ALTER TABLE "document" DROP CONSTRAINT "document_source_document_id_fkey";
ALTER TABLE "supplier_credit" DROP CONSTRAINT "supplier_credit_source_document_id_fkey";
ALTER TABLE "customer_credit" DROP CONSTRAINT "customer_credit_source_document_id_fkey";

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_document_item_id_fkey" FOREIGN KEY ("document_item_id") REFERENCES "document_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document" ADD CONSTRAINT "document_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_credit" ADD CONSTRAINT "supplier_credit_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
