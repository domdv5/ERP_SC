-- AlterTable
ALTER TABLE "document" ADD COLUMN "idempotency_key" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "document_idempotency_key_key" ON "document"("idempotency_key");
