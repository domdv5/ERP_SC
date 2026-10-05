-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'CMO';
ALTER TYPE "DocumentType" ADD VALUE 'POSO';

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "official_purchase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplier_invoice_number" VARCHAR(50),
ADD COLUMN     "tax_total" DECIMAL(16,2);

-- AlterTable
ALTER TABLE "document_item" ADD COLUMN     "tax_amount" DECIMAL(16,2);
