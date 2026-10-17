-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "document_dest_bin_id_fkey";

-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "document_dest_warehouse_id_fkey";

-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "document_source_bin_id_fkey";

-- DropForeignKey
ALTER TABLE "document" DROP CONSTRAINT "document_warehouse_id_fkey";

-- DropIndex
DROP INDEX "document_type_status_idx";

-- CreateIndex
CREATE INDEX "document_type_status_date_idx" ON "document"("type", "status", "date");

-- CreateIndex
CREATE INDEX "document_created_at_idx" ON "document"("created_at");

-- CreateIndex
CREATE INDEX "document_seller_id_idx" ON "document"("seller_id");

-- CreateIndex
CREATE INDEX "document_receiver_id_idx" ON "document"("receiver_id");

-- CreateIndex
CREATE INDEX "document_user_id_idx" ON "document"("user_id");

-- CreateIndex
CREATE INDEX "document_warehouse_id_idx" ON "document"("warehouse_id");

-- CreateIndex
CREATE INDEX "document_dest_warehouse_id_idx" ON "document"("dest_warehouse_id");

-- CreateIndex
CREATE INDEX "document_source_bin_id_idx" ON "document"("source_bin_id");

-- CreateIndex
CREATE INDEX "document_dest_bin_id_idx" ON "document"("dest_bin_id");

-- CreateIndex
CREATE INDEX "document_confirmed_by_id_idx" ON "document"("confirmed_by_id");

-- CreateIndex
CREATE INDEX "document_voided_by_id_idx" ON "document"("voided_by_id");

-- CreateIndex
CREATE INDEX "document_updated_by_id_idx" ON "document"("updated_by_id");

-- CreateIndex
CREATE INDEX "document_converted_by_id_idx" ON "document"("converted_by_id");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_dest_warehouse_id_fkey" FOREIGN KEY ("dest_warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_source_bin_id_fkey" FOREIGN KEY ("source_bin_id") REFERENCES "bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_dest_bin_id_fkey" FOREIGN KEY ("dest_bin_id") REFERENCES "bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

