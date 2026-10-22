-- AlterTable: los ítems existentes toman su created_at como hora de agregado
ALTER TABLE "document_item" ADD COLUMN "added_at" TIMESTAMPTZ;
UPDATE "document_item" SET "added_at" = "created_at";
ALTER TABLE "document_item" ALTER COLUMN "added_at" SET NOT NULL;
ALTER TABLE "document_item" ALTER COLUMN "added_at" SET DEFAULT CURRENT_TIMESTAMP;
