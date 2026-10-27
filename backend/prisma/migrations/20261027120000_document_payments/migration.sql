-- CreateTable
CREATE TABLE "document_payment" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_payment_document_id_method_key" ON "document_payment"("document_id", "method");

-- AddForeignKey
ALTER TABLE "document_payment" ADD CONSTRAINT "document_payment_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: cada venta con forma de pago queda con una línea por lo cobrado (total − saldos a favor aplicados)
INSERT INTO "document_payment" ("id", "document_id", "method", "amount", "created_at")
SELECT gen_random_uuid(), d."id", d."payment_method", d."total" - COALESCE(a."applied", 0), d."created_at"
FROM "document" d
LEFT JOIN (
    SELECT "sale_document_id", SUM("amount") AS "applied"
    FROM "customer_credit_application"
    GROUP BY "sale_document_id"
) a ON a."sale_document_id" = d."id"
WHERE d."payment_method" IS NOT NULL
  AND d."total" - COALESCE(a."applied", 0) > 0;

-- AlterTable
ALTER TABLE "document" DROP COLUMN "payment_method";
