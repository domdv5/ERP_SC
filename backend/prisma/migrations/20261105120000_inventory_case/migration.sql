-- CreateEnum
CREATE TYPE "InventoryCaseStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "InventoryCaseCause" AS ENUM ('venta_otro_producto', 'traslado_mal_registrado', 'compra_mal_digitada', 'devolucion_no_registrada', 'error_conteo', 'perdida_faltante', 'otro', 'ajuste_anulado');

-- CreateTable
CREATE TABLE "inventory_case" (
    "id" UUID NOT NULL,
    "number" VARCHAR(10) NOT NULL,
    "document_id" UUID NOT NULL,
    "document_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stock_before" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,
    "status" "InventoryCaseStatus" NOT NULL DEFAULT 'open',
    "cause" "InventoryCaseCause",
    "justification" VARCHAR(1000),
    "origin_document_id" UUID,
    "closed_by_id" UUID,
    "closed_at" TIMESTAMPTZ,
    "reopened_by_id" UUID,
    "reopened_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_case_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_case_number_key" ON "inventory_case"("number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_case_document_item_id_key" ON "inventory_case"("document_item_id");

-- CreateIndex
CREATE INDEX "inventory_case_status_created_at_idx" ON "inventory_case"("status", "created_at");

-- CreateIndex
CREATE INDEX "inventory_case_created_at_idx" ON "inventory_case"("created_at");

-- CreateIndex
CREATE INDEX "inventory_case_document_id_idx" ON "inventory_case"("document_id");

-- CreateIndex
CREATE INDEX "inventory_case_product_id_idx" ON "inventory_case"("product_id");

-- CreateIndex
CREATE INDEX "inventory_case_warehouse_id_idx" ON "inventory_case"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_case_origin_document_id_idx" ON "inventory_case"("origin_document_id");

-- CreateIndex
CREATE INDEX "inventory_case_closed_by_id_idx" ON "inventory_case"("closed_by_id");

-- CreateIndex
CREATE INDEX "inventory_case_reopened_by_id_idx" ON "inventory_case"("reopened_by_id");

-- AddForeignKey
ALTER TABLE "inventory_case" ADD CONSTRAINT "inventory_case_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_case" ADD CONSTRAINT "inventory_case_document_item_id_fkey" FOREIGN KEY ("document_item_id") REFERENCES "document_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_case" ADD CONSTRAINT "inventory_case_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_case" ADD CONSTRAINT "inventory_case_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_case" ADD CONSTRAINT "inventory_case_origin_document_id_fkey" FOREIGN KEY ("origin_document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_case" ADD CONSTRAINT "inventory_case_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_case" ADD CONSTRAINT "inventory_case_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

