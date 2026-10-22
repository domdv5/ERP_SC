-- AlterTable: hora de cada acción; los documentos previos toman updated_at como aproximación
ALTER TABLE "document" ADD COLUMN "confirmed_at" TIMESTAMPTZ,
ADD COLUMN "edited_at" TIMESTAMPTZ,
ADD COLUMN "voided_at" TIMESTAMPTZ;

UPDATE "document" SET "confirmed_at" = "updated_at" WHERE "confirmed_by_id" IS NOT NULL;
UPDATE "document" SET "edited_at" = "updated_at" WHERE "updated_by_id" IS NOT NULL;
UPDATE "document" SET "voided_at" = "updated_at" WHERE "voided_by_id" IS NOT NULL;
