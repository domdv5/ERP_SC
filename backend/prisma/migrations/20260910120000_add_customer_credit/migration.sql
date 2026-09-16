-- CreateEnum
CREATE TYPE "DvvRefundMethod" AS ENUM ('saldo_a_favor', 'cambio_producto', 'devolucion_dinero');

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "refund_method" "DvvRefundMethod";

-- CreateTable
CREATE TABLE "customer_credit" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "balance" DECIMAL(16,2) NOT NULL,
    "source_document_id" UUID,
    "status" VARCHAR(10) NOT NULL DEFAULT 'available',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credit_application" (
    "id" UUID NOT NULL,
    "customer_credit_id" UUID NOT NULL,
    "sale_document_id" UUID NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_credit_application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_credit_customer_id_status_created_at_idx" ON "customer_credit"("customer_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_source_document_id_key" ON "customer_credit"("source_document_id");

-- CreateIndex
CREATE INDEX "customer_credit_application_sale_document_id_idx" ON "customer_credit_application"("sale_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_application_customer_credit_id_sale_documen_key" ON "customer_credit_application"("customer_credit_id", "sale_document_id");

-- AddForeignKey
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_application" ADD CONSTRAINT "customer_credit_application_customer_credit_id_fkey" FOREIGN KEY ("customer_credit_id") REFERENCES "customer_credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_application" ADD CONSTRAINT "customer_credit_application_sale_document_id_fkey" FOREIGN KEY ("sale_document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint (agregado a mano: Prisma no declara CHECKs).
-- Red de última instancia contra un saldo a favor corrupto — 0 <= balance <= amount.
-- Aprobado explícitamente por ser dinero; primer CHECK del schema.
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_balance_range_chk" CHECK ("balance" >= 0 AND "balance" <= "amount");
