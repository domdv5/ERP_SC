-- AlterTable
ALTER TABLE "document" ADD COLUMN     "customer_branch_id" UUID;

-- CreateTable
CREATE TABLE "customer_branch" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(300),
    "phone" VARCHAR(50),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_branch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_branch_customer_id_name_key" ON "customer_branch"("customer_id", "name");

-- CreateIndex
CREATE INDEX "document_customer_branch_id_idx" ON "document"("customer_branch_id");

-- AddForeignKey
ALTER TABLE "customer_branch" ADD CONSTRAINT "customer_branch_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_customer_branch_id_fkey" FOREIGN KEY ("customer_branch_id") REFERENCES "customer_branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
