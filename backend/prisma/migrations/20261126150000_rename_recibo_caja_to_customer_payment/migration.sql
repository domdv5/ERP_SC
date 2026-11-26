-- Renombra recibo_caja -> customer_payment solo con RENAME: sin DROP ni copia de datos.

-- Tipos enum
ALTER TYPE "ReciboCajaVoidReason" RENAME TO "CustomerPaymentVoidReason";
ALTER TYPE "ReciboCajaDiscountReason" RENAME TO "CustomerPaymentDiscountReason";

-- Tablas
ALTER TABLE "recibo_caja" RENAME TO "customer_payment";
ALTER TABLE "recibo_caja_payment" RENAME TO "customer_payment_method";
ALTER TABLE "recibo_caja_allocation" RENAME TO "customer_payment_allocation";

-- Columnas
ALTER TABLE "customer_payment_method" RENAME COLUMN "recibo_caja_id" TO "customer_payment_id";
ALTER TABLE "customer_payment_allocation" RENAME COLUMN "recibo_caja_id" TO "customer_payment_id";
ALTER TABLE "customer_credit_application" RENAME COLUMN "recibo_caja_id" TO "customer_payment_id";

-- Claves primarias y foráneas (renombrar la constraint renombra también su índice)
ALTER TABLE "customer_payment" RENAME CONSTRAINT "recibo_caja_pkey" TO "customer_payment_pkey";
ALTER TABLE "customer_payment_method" RENAME CONSTRAINT "recibo_caja_payment_pkey" TO "customer_payment_method_pkey";
ALTER TABLE "customer_payment_allocation" RENAME CONSTRAINT "recibo_caja_allocation_pkey" TO "customer_payment_allocation_pkey";
ALTER TABLE "customer_payment" RENAME CONSTRAINT "recibo_caja_client_id_fkey" TO "customer_payment_client_id_fkey";
ALTER TABLE "customer_payment" RENAME CONSTRAINT "recibo_caja_user_id_fkey" TO "customer_payment_user_id_fkey";
ALTER TABLE "customer_payment" RENAME CONSTRAINT "recibo_caja_customer_branch_id_fkey" TO "customer_payment_customer_branch_id_fkey";
ALTER TABLE "customer_payment" RENAME CONSTRAINT "recibo_caja_voided_by_id_fkey" TO "customer_payment_voided_by_id_fkey";
ALTER TABLE "customer_payment_method" RENAME CONSTRAINT "recibo_caja_payment_recibo_caja_id_fkey" TO "customer_payment_method_customer_payment_id_fkey";
ALTER TABLE "customer_payment_allocation" RENAME CONSTRAINT "recibo_caja_allocation_recibo_caja_id_fkey" TO "customer_payment_allocation_customer_payment_id_fkey";
ALTER TABLE "customer_payment_allocation" RENAME CONSTRAINT "recibo_caja_allocation_account_receivable_id_fkey" TO "customer_payment_allocation_account_receivable_id_fkey";
ALTER TABLE "customer_credit_application" RENAME CONSTRAINT "customer_credit_application_recibo_caja_id_fkey" TO "customer_credit_application_customer_payment_id_fkey";

-- CHECKs
ALTER TABLE "customer_payment" RENAME CONSTRAINT "recibo_caja_total_chk" TO "customer_payment_total_chk";
ALTER TABLE "customer_payment" RENAME CONSTRAINT "recibo_caja_discount_chk" TO "customer_payment_discount_chk";
ALTER TABLE "customer_payment_method" RENAME CONSTRAINT "recibo_caja_payment_amount_positive_chk" TO "customer_payment_method_amount_positive_chk";
ALTER TABLE "customer_payment_allocation" RENAME CONSTRAINT "recibo_caja_allocation_amount_chk" TO "customer_payment_allocation_amount_chk";
ALTER TABLE "customer_payment_allocation" RENAME CONSTRAINT "recibo_caja_allocation_discount_chk" TO "customer_payment_allocation_discount_chk";
ALTER TABLE "customer_payment_allocation" RENAME CONSTRAINT "recibo_caja_allocation_credit_amount_chk" TO "customer_payment_allocation_credit_amount_chk";

-- Índices
ALTER INDEX "recibo_caja_number_key" RENAME TO "customer_payment_number_key";
ALTER INDEX "recibo_caja_idempotency_key_key" RENAME TO "customer_payment_idempotency_key_key";
ALTER INDEX "recibo_caja_date_idx" RENAME TO "customer_payment_date_idx";
ALTER INDEX "recibo_caja_client_id_date_idx" RENAME TO "customer_payment_client_id_date_idx";
ALTER INDEX "recibo_caja_user_id_idx" RENAME TO "customer_payment_user_id_idx";
ALTER INDEX "recibo_caja_customer_branch_id_idx" RENAME TO "customer_payment_customer_branch_id_idx";
ALTER INDEX "recibo_caja_payment_recibo_caja_id_idx" RENAME TO "customer_payment_method_customer_payment_id_idx";
ALTER INDEX "recibo_caja_allocation_account_receivable_id_idx" RENAME TO "customer_payment_allocation_account_receivable_id_idx";
ALTER INDEX "recibo_caja_allocation_recibo_caja_id_account_receivable_id_key" RENAME TO "customer_payment_allocation_customer_payment_id_account_rec_key";
ALTER INDEX "customer_credit_application_recibo_caja_id_idx" RENAME TO "customer_credit_application_customer_payment_id_idx";
ALTER INDEX "customer_credit_application_customer_credit_id_recibo_caja__key" RENAME TO "customer_credit_application_customer_credit_id_customer_pay_key";

-- Permisos RBAC: se renombra el código, las filas y sus role_permission se conservan
UPDATE "permission" SET "code" = 'customer_payment.' || substring("code" from 8) WHERE "code" LIKE 'recibo.%';
