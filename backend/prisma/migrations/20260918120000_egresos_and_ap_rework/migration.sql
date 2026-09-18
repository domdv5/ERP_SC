-- Módulo de Egresos + rework de Cuentas por Pagar a solo consulta.
-- Migración manual (workaround de backend/CLAUDE.md): `prisma migrate diff` genera
-- DROP COLUMN "status" para accounts_payable/accounts_receivable (perdería los
-- valores existentes) y también arrastra el DROP INDEX de los 2 índices trigram de
-- product ("DRIFT ACEPTADO" en schema.prisma) — ninguno de los dos se copia acá.

-- ── 1. Enums nuevos ─────────────────────────────────────────────────────────────

CREATE TYPE "AccountsPayableStatus" AS ENUM ('pending', 'partial', 'paid');
CREATE TYPE "AccountsReceivableStatus" AS ENUM ('pending', 'partial', 'paid');
CREATE TYPE "EgresoPaymentMethod" AS ENUM ('efectivo_almacen', 'consignacion_almacen', 'cheque', 'efectivo_oficina', 'consignacion_oficina');

-- ── 2. accounts_payable.status: varchar -> enum (cast, no DROP COLUMN) ──────────
-- DROP DEFAULT antes del ALTER TYPE: Postgres rechaza el cast si la columna tiene
-- un default pendiente de convertir. varchar -> enum no tiene cast implícito directo,
-- se pasa por texto.

ALTER TABLE "accounts_payable" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "accounts_payable" ALTER COLUMN "status" TYPE "AccountsPayableStatus" USING "status"::text::"AccountsPayableStatus";
ALTER TABLE "accounts_payable" ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "accounts_receivable" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "accounts_receivable" ALTER COLUMN "status" TYPE "AccountsReceivableStatus" USING "status"::text::"AccountsReceivableStatus";
ALTER TABLE "accounts_receivable" ALTER COLUMN "status" SET DEFAULT 'pending';

-- ── 3. accounts_payable.paid_amount + backfill + reparo de status desincronizado ─

ALTER TABLE "accounts_payable" ADD COLUMN "paid_amount" DECIMAL(16,2) NOT NULL DEFAULT 0;

-- Backfill desde el historial de payable_payments + supplier_credit_application.
UPDATE "accounts_payable" ap
SET "paid_amount" = (
  COALESCE((SELECT SUM(amount) FROM "payable_payments" WHERE account_payable_id = ap.id), 0)
  + COALESCE((SELECT SUM(amount) FROM "supplier_credit_application" WHERE account_payable_id = ap.id), 0)
);

-- Repara status a partir de paid_amount recién calculado (encontrada 1 fila con
-- status desincronizado del pago real: nunca se recalculó por fuera de registerPayment).
UPDATE "accounts_payable"
SET "status" = CASE
  WHEN "paid_amount" <= 0 THEN 'pending'::"AccountsPayableStatus"
  WHEN "paid_amount" >= "total_amount" THEN 'paid'::"AccountsPayableStatus"
  ELSE 'partial'::"AccountsPayableStatus"
END;

-- CHECKs (deben ir DESPUÉS del backfill/reparo de arriba, o fallan sobre datos viejos).
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_paid_amount_range_chk"
  CHECK ("paid_amount" >= 0 AND "paid_amount" <= "total_amount");

ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_status_paid_chk" CHECK (
  (status = 'pending' AND paid_amount = 0)
  OR (status = 'partial' AND paid_amount > 0 AND paid_amount < total_amount)
  OR (status = 'paid' AND paid_amount >= total_amount)
);

-- ── 4. Índices de FK faltantes (accounts_payable/accounts_receivable y sus pagos
--       solo tenían la PK — gap preexistente, se corrige de paso porque ya se tocan) ─

CREATE INDEX "accounts_payable_supplier_id_status_idx" ON "accounts_payable"("supplier_id", "status");
CREATE INDEX "accounts_payable_document_id_idx" ON "accounts_payable"("document_id");
CREATE INDEX "accounts_payable_due_date_idx" ON "accounts_payable"("due_date");

CREATE INDEX "accounts_receivable_client_id_status_idx" ON "accounts_receivable"("client_id", "status");
CREATE INDEX "accounts_receivable_seller_id_idx" ON "accounts_receivable"("seller_id");
CREATE INDEX "accounts_receivable_document_id_idx" ON "accounts_receivable"("document_id");
CREATE INDEX "accounts_receivable_due_date_idx" ON "accounts_receivable"("due_date");

CREATE INDEX "payable_payments_account_payable_id_idx" ON "payable_payments"("account_payable_id");
CREATE INDEX "receivable_payments_account_receivable_id_idx" ON "receivable_payments"("account_receivable_id");

-- ── 5. Endurecer supplier_credit (mismo patrón que customer_credit) ─────────────

DROP INDEX "supplier_credit_supplier_id_status_idx";
CREATE INDEX "supplier_credit_supplier_id_status_created_at_idx" ON "supplier_credit"("supplier_id", "status", "created_at");
CREATE UNIQUE INDEX "supplier_credit_source_document_id_key" ON "supplier_credit"("source_document_id");

ALTER TABLE "supplier_credit" ADD CONSTRAINT "supplier_credit_balance_range_chk"
  CHECK ("balance" >= 0 AND "balance" <= "amount");

-- ── 6. Tabla de consecutivos + backfill desde el máximo actual por tipo ─────────

CREATE TABLE "sequence" (
    "key" VARCHAR(30) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequence_pkey" PRIMARY KEY ("key")
);

-- RMDVC y PE no tienen filas todavía: no necesitan semilla, la crea el primer uso.
-- No se siembra 'EGRESO' tampoco, mismo motivo.
INSERT INTO "sequence" ("key", "last_value")
SELECT "type"::text, MAX("number"::int) FROM "document" GROUP BY "type"
ON CONFLICT ("key") DO NOTHING;

-- ── 7. Egreso / EgresoPayment / EgresoAllocation ────────────────────────────────

CREATE TABLE "egreso" (
    "id" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "date" DATE NOT NULL,
    "supplier_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "total" DECIMAL(16,2) NOT NULL,
    "cash_total" DECIMAL(16,2) NOT NULL,
    "credit_total" DECIMAL(16,2) NOT NULL,
    "notes" VARCHAR(500),
    "idempotency_key" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egreso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "egreso_payment" (
    "id" UUID NOT NULL,
    "egreso_id" UUID NOT NULL,
    "method" "EgresoPaymentMethod" NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "reference" VARCHAR(100),
    "bank" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egreso_payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "egreso_allocation" (
    "id" UUID NOT NULL,
    "egreso_id" UUID NOT NULL,
    "account_payable_id" UUID NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "credit_amount" DECIMAL(16,2) NOT NULL DEFAULT 0,

    CONSTRAINT "egreso_allocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "egreso_number_key" ON "egreso"("number");
CREATE UNIQUE INDEX "egreso_idempotency_key_key" ON "egreso"("idempotency_key");
CREATE INDEX "egreso_date_idx" ON "egreso"("date");
CREATE INDEX "egreso_supplier_id_date_idx" ON "egreso"("supplier_id", "date");
CREATE INDEX "egreso_user_id_idx" ON "egreso"("user_id");

CREATE INDEX "egreso_payment_egreso_id_idx" ON "egreso_payment"("egreso_id");

CREATE INDEX "egreso_allocation_account_payable_id_idx" ON "egreso_allocation"("account_payable_id");
CREATE UNIQUE INDEX "egreso_allocation_egreso_id_account_payable_id_key" ON "egreso_allocation"("egreso_id", "account_payable_id");

ALTER TABLE "egreso" ADD CONSTRAINT "egreso_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "egreso" ADD CONSTRAINT "egreso_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "egreso_payment" ADD CONSTRAINT "egreso_payment_egreso_id_fkey" FOREIGN KEY ("egreso_id") REFERENCES "egreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "egreso_allocation" ADD CONSTRAINT "egreso_allocation_egreso_id_fkey" FOREIGN KEY ("egreso_id") REFERENCES "egreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "egreso_allocation" ADD CONSTRAINT "egreso_allocation_account_payable_id_fkey" FOREIGN KEY ("account_payable_id") REFERENCES "accounts_payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "egreso" ADD CONSTRAINT "egreso_totals_chk"
  CHECK ("cash_total" >= 0 AND "credit_total" >= 0 AND "total" = "cash_total" + "credit_total" AND "total" > 0);

ALTER TABLE "egreso_payment" ADD CONSTRAINT "egreso_payment_amount_positive_chk"
  CHECK ("amount" > 0);

ALTER TABLE "egreso_allocation" ADD CONSTRAINT "egreso_allocation_amount_chk"
  CHECK ("amount" > 0 AND "credit_amount" >= 0 AND "credit_amount" <= "amount");

-- ── 8. supplier_credit_application.egreso_id (nullable — historial viejo sin egreso) ─

ALTER TABLE "supplier_credit_application" ADD COLUMN "egreso_id" UUID;

CREATE UNIQUE INDEX "supplier_credit_application_egreso_id_account_payable_id_su_key" ON "supplier_credit_application"("egreso_id", "account_payable_id", "supplier_credit_id");

ALTER TABLE "supplier_credit_application" ADD CONSTRAINT "supplier_credit_application_egreso_id_fkey" FOREIGN KEY ("egreso_id") REFERENCES "egreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
