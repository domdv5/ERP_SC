-- CreateEnum
CREATE TYPE "EgresoVoidReason" AS ENUM ('valor_equivocado', 'proveedor_equivocado', 'factura_equivocada', 'forma_pago_equivocada', 'pago_duplicado', 'pago_no_realizado', 'otro');

-- AlterTable: el texto libre anterior pasa a void_reason_other y el motivo queda como 'otro'
ALTER TABLE "egreso" ADD COLUMN "void_reason_other" VARCHAR(500);

UPDATE "egreso" SET "void_reason_other" = "void_reason" WHERE "void_reason" IS NOT NULL;

ALTER TABLE "egreso" ALTER COLUMN "void_reason" TYPE "EgresoVoidReason" USING (CASE WHEN "void_reason" IS NULL THEN NULL ELSE 'otro'::"EgresoVoidReason" END);
