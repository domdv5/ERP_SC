-- Módulo de Recibos de Caja (contraparte de Egresos, lado CxC) + rework de
-- AccountsReceivable.paidAmount, mismo patrón que 20260918120000_egresos_and_ap_rework.
-- Migración manual (workaround de backend/CLAUDE.md): el diff de `prisma migrate diff`
-- arrastra el DROP INDEX de los 2 índices trigram de product ("DRIFT ACEPTADO" en
-- schema.prisma) — no se copian acá.

-- ── 1. accounts_receivable.paid_amount + backfill + CHECKs ─────────────────────

ALTER TABLE "accounts_receivable" ADD COLUMN "paid_amount" DECIMAL(16,2) NOT NULL DEFAULT 0;

-- Backfill desde el historial de receivable_payments (único origen de pago hasta ahora).
UPDATE "accounts_receivable" ar
SET "paid_amount" = COALESCE(
  (SELECT SUM(amount) FROM "receivable_payments" WHERE account_receivable_id = ar.id), 0
);

-- Repara status a partir de paid_amount recién calculado, mismo motivo que el rework de AP.
-- Orden importa: un COT que aplicó saldo a favor puede nacer con total_amount=0 y
-- status='paid' (ver CotEffectStrategy en backend/CLAUDE.md) — paid_amount backfillea
-- a 0 para esas filas (nunca tuvieron un receivable_payment real), así que hay que
-- chequear "paid_amount >= total_amount" ANTES que "paid_amount <= 0" o esas filas
-- se reescriben a 'pending' con un saldo que nunca se puede cobrar.
UPDATE "accounts_receivable"
SET "status" = CASE
  WHEN "paid_amount" >= "total_amount" THEN 'paid'::"AccountsReceivableStatus"
  WHEN "paid_amount" <= 0 THEN 'pending'::"AccountsReceivableStatus"
  ELSE 'partial'::"AccountsReceivableStatus"
END;

ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_paid_amount_range_chk"
  CHECK ("paid_amount" >= 0 AND "paid_amount" <= "total_amount");

ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_status_paid_chk" CHECK (
  (status = 'pending' AND paid_amount = 0)
  OR (status = 'partial' AND paid_amount > 0 AND paid_amount < total_amount)
  OR (status = 'paid' AND paid_amount >= total_amount)
);

-- ── 2. ReciboCaja / ReciboCajaPayment / ReciboCajaAllocation ────────────────────

CREATE TABLE "recibo_caja" (
    "id" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "date" DATE NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "total" DECIMAL(16,2) NOT NULL,
    "notes" VARCHAR(500),
    "idempotency_key" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recibo_caja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recibo_caja_payment" (
    "id" UUID NOT NULL,
    "recibo_caja_id" UUID NOT NULL,
    "method" "EgresoPaymentMethod" NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "reference" VARCHAR(100),
    "bank" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recibo_caja_payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recibo_caja_allocation" (
    "id" UUID NOT NULL,
    "recibo_caja_id" UUID NOT NULL,
    "account_receivable_id" UUID NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "recibo_caja_allocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recibo_caja_number_key" ON "recibo_caja"("number");
CREATE UNIQUE INDEX "recibo_caja_idempotency_key_key" ON "recibo_caja"("idempotency_key");
CREATE INDEX "recibo_caja_date_idx" ON "recibo_caja"("date");
CREATE INDEX "recibo_caja_client_id_date_idx" ON "recibo_caja"("client_id", "date");
CREATE INDEX "recibo_caja_user_id_idx" ON "recibo_caja"("user_id");

CREATE INDEX "recibo_caja_payment_recibo_caja_id_idx" ON "recibo_caja_payment"("recibo_caja_id");

CREATE INDEX "recibo_caja_allocation_account_receivable_id_idx" ON "recibo_caja_allocation"("account_receivable_id");
CREATE UNIQUE INDEX "recibo_caja_allocation_recibo_caja_id_account_receivable_id_key" ON "recibo_caja_allocation"("recibo_caja_id", "account_receivable_id");

ALTER TABLE "recibo_caja" ADD CONSTRAINT "recibo_caja_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recibo_caja" ADD CONSTRAINT "recibo_caja_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recibo_caja_payment" ADD CONSTRAINT "recibo_caja_payment_recibo_caja_id_fkey" FOREIGN KEY ("recibo_caja_id") REFERENCES "recibo_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recibo_caja_allocation" ADD CONSTRAINT "recibo_caja_allocation_recibo_caja_id_fkey" FOREIGN KEY ("recibo_caja_id") REFERENCES "recibo_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recibo_caja_allocation" ADD CONSTRAINT "recibo_caja_allocation_account_receivable_id_fkey" FOREIGN KEY ("account_receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recibo_caja" ADD CONSTRAINT "recibo_caja_total_chk" CHECK ("total" > 0);

ALTER TABLE "recibo_caja_payment" ADD CONSTRAINT "recibo_caja_payment_amount_positive_chk"
  CHECK ("amount" > 0);

ALTER TABLE "recibo_caja_allocation" ADD CONSTRAINT "recibo_caja_allocation_amount_chk"
  CHECK ("amount" > 0);
