-- CreateTable
CREATE TABLE "supplier_credit" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "balance" DECIMAL(16,2) NOT NULL,
    "source_document_id" UUID,
    "status" VARCHAR(10) NOT NULL DEFAULT 'available',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credit_application" (
    "id" UUID NOT NULL,
    "supplier_credit_id" UUID NOT NULL,
    "account_payable_id" UUID NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_credit_application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_credit_supplier_id_status_idx" ON "supplier_credit"("supplier_id", "status");

-- CreateIndex
CREATE INDEX "supplier_credit_application_account_payable_id_idx" ON "supplier_credit_application"("account_payable_id");

-- AddForeignKey
ALTER TABLE "supplier_credit" ADD CONSTRAINT "supplier_credit_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit" ADD CONSTRAINT "supplier_credit_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_application" ADD CONSTRAINT "supplier_credit_application_supplier_credit_id_fkey" FOREIGN KEY ("supplier_credit_id") REFERENCES "supplier_credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_application" ADD CONSTRAINT "supplier_credit_application_account_payable_id_fkey" FOREIGN KEY ("account_payable_id") REFERENCES "accounts_payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
