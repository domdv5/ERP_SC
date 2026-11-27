-- CreateEnum
CREATE TYPE "SupplierCreditKind" AS ENUM ('devolucion', 'excedente');

-- CreateEnum
CREATE TYPE "ExcessVoidReason" AS ENUM ('valor_mal_digitado', 'tercero_equivocado', 'otro');

-- AlterTable
ALTER TABLE "customer_credit" ADD COLUMN     "number" VARCHAR(20),
ADD COLUMN     "void_reason" "ExcessVoidReason",
ADD COLUMN     "void_reason_other" VARCHAR(500);

-- AlterTable
ALTER TABLE "supplier_credit" ADD COLUMN     "date" DATE,
ADD COLUMN     "kind" "SupplierCreditKind" NOT NULL DEFAULT 'devolucion',
ADD COLUMN     "number" VARCHAR(20),
ADD COLUMN     "user_id" UUID,
ADD COLUMN     "void_reason" "ExcessVoidReason",
ADD COLUMN     "void_reason_other" VARCHAR(500),
ADD COLUMN     "voided_at" TIMESTAMPTZ,
ADD COLUMN     "voided_by_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_number_key" ON "customer_credit"("number");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_number_key" ON "supplier_credit"("number");

-- AddForeignKey
ALTER TABLE "supplier_credit" ADD CONSTRAINT "supplier_credit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit" ADD CONSTRAINT "supplier_credit_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Numera los excedentes de cliente existentes por fecha y deja el consecutivo EXCESS en el último número
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "date" NULLS LAST, created_at, id) AS position
  FROM "customer_credit"
  WHERE kind = 'excedente'
)
UPDATE "customer_credit" AS credit
SET "number" = LPAD(numbered.position::text, 6, '0')
FROM numbered
WHERE credit.id = numbered.id;

INSERT INTO "sequence" ("key", "last_value")
SELECT 'EXCESS', COUNT(*) FROM "customer_credit" WHERE kind = 'excedente'
HAVING COUNT(*) > 0;

-- Todo excedente tiene número EXC y ninguna devolución lo tiene
ALTER TABLE "customer_credit" ADD CONSTRAINT "customer_credit_number_chk"
  CHECK ((kind = 'excedente') = ("number" IS NOT NULL));
ALTER TABLE "supplier_credit" ADD CONSTRAINT "supplier_credit_number_chk"
  CHECK ((kind = 'excedente') = ("number" IS NOT NULL));

ALTER TABLE "supplier_credit" ADD CONSTRAINT "supplier_credit_voided_chk"
  CHECK (("status" = 'voided') = ("voided_at" IS NOT NULL AND "voided_by_id" IS NOT NULL));
