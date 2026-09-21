-- CreateIndex
CREATE INDEX "inventory_movements_document_id_idx" ON "inventory_movements"("document_id");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_created_at_idx" ON "inventory_movements"("product_id", "created_at");
