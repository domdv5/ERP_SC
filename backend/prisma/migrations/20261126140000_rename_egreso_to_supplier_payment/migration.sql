-- Renombra egreso -> supplier_payment solo con RENAME: sin DROP ni copia de datos.

-- Tipos enum
ALTER TYPE "EgresoPaymentMethod" RENAME TO "TreasuryPaymentMethod";
ALTER TYPE "EgresoVoidReason" RENAME TO "SupplierPaymentVoidReason";

-- Tablas
ALTER TABLE "egreso" RENAME TO "supplier_payment";
ALTER TABLE "egreso_payment" RENAME TO "supplier_payment_method";
ALTER TABLE "egreso_allocation" RENAME TO "supplier_payment_allocation";

-- Columnas
ALTER TABLE "supplier_payment_method" RENAME COLUMN "egreso_id" TO "supplier_payment_id";
ALTER TABLE "supplier_payment_allocation" RENAME COLUMN "egreso_id" TO "supplier_payment_id";
ALTER TABLE "supplier_credit_application" RENAME COLUMN "egreso_id" TO "supplier_payment_id";

-- Claves primarias y foráneas (renombrar la constraint renombra también su índice)
ALTER TABLE "supplier_payment" RENAME CONSTRAINT "egreso_pkey" TO "supplier_payment_pkey";
ALTER TABLE "supplier_payment_method" RENAME CONSTRAINT "egreso_payment_pkey" TO "supplier_payment_method_pkey";
ALTER TABLE "supplier_payment_allocation" RENAME CONSTRAINT "egreso_allocation_pkey" TO "supplier_payment_allocation_pkey";
ALTER TABLE "supplier_payment" RENAME CONSTRAINT "egreso_supplier_id_fkey" TO "supplier_payment_supplier_id_fkey";
ALTER TABLE "supplier_payment" RENAME CONSTRAINT "egreso_user_id_fkey" TO "supplier_payment_user_id_fkey";
ALTER TABLE "supplier_payment" RENAME CONSTRAINT "egreso_voided_by_id_fkey" TO "supplier_payment_voided_by_id_fkey";
ALTER TABLE "supplier_payment_method" RENAME CONSTRAINT "egreso_payment_egreso_id_fkey" TO "supplier_payment_method_supplier_payment_id_fkey";
ALTER TABLE "supplier_payment_allocation" RENAME CONSTRAINT "egreso_allocation_egreso_id_fkey" TO "supplier_payment_allocation_supplier_payment_id_fkey";
ALTER TABLE "supplier_payment_allocation" RENAME CONSTRAINT "egreso_allocation_account_payable_id_fkey" TO "supplier_payment_allocation_account_payable_id_fkey";
ALTER TABLE "supplier_credit_application" RENAME CONSTRAINT "supplier_credit_application_egreso_id_fkey" TO "supplier_credit_application_supplier_payment_id_fkey";

-- CHECKs
ALTER TABLE "supplier_payment" RENAME CONSTRAINT "egreso_totals_chk" TO "supplier_payment_totals_chk";
ALTER TABLE "supplier_payment_allocation" RENAME CONSTRAINT "egreso_allocation_amount_chk" TO "supplier_payment_allocation_amount_chk";
ALTER TABLE "supplier_payment_method" RENAME CONSTRAINT "egreso_payment_amount_positive_chk" TO "supplier_payment_method_amount_positive_chk";

-- Índices
ALTER INDEX "egreso_date_idx" RENAME TO "supplier_payment_date_idx";
ALTER INDEX "egreso_supplier_id_date_idx" RENAME TO "supplier_payment_supplier_id_date_idx";
ALTER INDEX "egreso_user_id_idx" RENAME TO "supplier_payment_user_id_idx";
ALTER INDEX "egreso_number_key" RENAME TO "supplier_payment_number_key";
ALTER INDEX "egreso_idempotency_key_key" RENAME TO "supplier_payment_idempotency_key_key";
ALTER INDEX "egreso_payment_egreso_id_idx" RENAME TO "supplier_payment_method_supplier_payment_id_idx";
ALTER INDEX "egreso_allocation_account_payable_id_idx" RENAME TO "supplier_payment_allocation_account_payable_id_idx";
ALTER INDEX "egreso_allocation_egreso_id_account_payable_id_key" RENAME TO "supplier_payment_allocation_supplier_payment_id_account_pay_key";
ALTER INDEX "supplier_credit_application_egreso_id_account_payable_id_su_key" RENAME TO "supplier_credit_application_supplier_payment_id_account_pay_key";

-- Permisos RBAC: se renombra el código, las filas y sus role_permission se conservan
UPDATE "permission" SET "code" = 'supplier_payment.' || substring("code" from 8) WHERE "code" LIKE 'egreso.%';
