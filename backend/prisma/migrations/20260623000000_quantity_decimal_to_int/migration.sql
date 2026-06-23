-- AlterTable
ALTER TABLE "document_item" ALTER COLUMN "quantity" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "inventory" ALTER COLUMN "quantity" SET DEFAULT 0,
ALTER COLUMN "quantity" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "inventory_movements" ALTER COLUMN "quantity" SET DATA TYPE INTEGER,
ALTER COLUMN "previous_stock" SET DATA TYPE INTEGER,
ALTER COLUMN "new_stock" SET DATA TYPE INTEGER;
