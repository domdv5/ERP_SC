-- DropIndex
DROP INDEX "product_active_brand_id_idx";

-- DropIndex
DROP INDEX "product_active_category_id_idx";

-- DropIndex
DROP INDEX "product_active_gender_id_idx";

-- DropIndex
DROP INDEX "product_active_idx";

-- CreateIndex
CREATE INDEX "document_item_document_id_idx" ON "document_item"("document_id");

-- CreateIndex
CREATE INDEX "product_active_created_at_idx" ON "product"("active", "created_at");

-- CreateIndex
CREATE INDEX "product_active_brand_id_created_at_idx" ON "product"("active", "brand_id", "created_at");

-- CreateIndex
CREATE INDEX "product_active_category_id_created_at_idx" ON "product"("active", "category_id", "created_at");

-- CreateIndex
CREATE INDEX "product_active_gender_id_created_at_idx" ON "product"("active", "gender_id", "created_at");
