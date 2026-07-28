-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'PV';

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "seller_id" UUID;

-- AlterTable
ALTER TABLE "document_item" ADD COLUMN     "converted_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "released_quantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reservation_release" (
    "id" UUID NOT NULL,
    "document_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_release_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_release_document_item_id_idx" ON "reservation_release"("document_item_id");

-- CreateIndex
CREATE INDEX "document_item_product_id_idx" ON "document_item"("product_id");

-- CreateIndex
CREATE INDEX "third_parties_is_seller_idx" ON "third_parties"("is_seller");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "third_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_release" ADD CONSTRAINT "reservation_release_document_item_id_fkey" FOREIGN KEY ("document_item_id") REFERENCES "document_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_release" ADD CONSTRAINT "reservation_release_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
