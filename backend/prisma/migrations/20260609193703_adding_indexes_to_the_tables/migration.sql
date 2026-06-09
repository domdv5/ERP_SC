-- CreateIndex
CREATE INDEX "brand_active_idx" ON "brand"("active");

-- CreateIndex
CREATE INDEX "brand_supplier_id_idx" ON "brand"("supplier_id");

-- CreateIndex
CREATE INDEX "category_active_idx" ON "category"("active");

-- CreateIndex
CREATE INDEX "gender_active_idx" ON "gender"("active");

-- CreateIndex
CREATE INDEX "product_active_idx" ON "product"("active");

-- CreateIndex
CREATE INDEX "product_brand_id_idx" ON "product"("brand_id");

-- CreateIndex
CREATE INDEX "product_gender_id_idx" ON "product"("gender_id");

-- CreateIndex
CREATE INDEX "product_category_id_idx" ON "product"("category_id");

-- CreateIndex
CREATE INDEX "product_created_at_idx" ON "product"("created_at");

-- CreateIndex
CREATE INDEX "product_active_brand_id_idx" ON "product"("active", "brand_id");

-- CreateIndex
CREATE INDEX "product_active_category_id_idx" ON "product"("active", "category_id");

-- CreateIndex
CREATE INDEX "product_active_gender_id_idx" ON "product"("active", "gender_id");

-- CreateIndex
CREATE INDEX "third_parties_is_active_idx" ON "third_parties"("is_active");

-- CreateIndex
CREATE INDEX "third_parties_is_customer_idx" ON "third_parties"("is_customer");

-- CreateIndex
CREATE INDEX "third_parties_is_supplier_idx" ON "third_parties"("is_supplier");

-- CreateIndex
CREATE INDEX "third_parties_created_at_idx" ON "third_parties"("created_at");
