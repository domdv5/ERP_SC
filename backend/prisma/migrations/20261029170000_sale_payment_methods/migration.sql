-- Une tarjeta + transferencia de un mismo documento en una sola fila (el único es documento+forma).
WITH merged AS (
  SELECT document_id, MIN(id::text)::uuid AS keep_id, SUM(amount) AS total
  FROM "document_payment"
  WHERE "method"::text IN ('tarjeta', 'transferencia')
  GROUP BY document_id
  HAVING COUNT(*) > 1
)
UPDATE "document_payment" dp SET "amount" = m.total
FROM merged m WHERE dp."id" = m.keep_id;

DELETE FROM "document_payment" dp
USING (
  SELECT document_id, MIN(id::text)::uuid AS keep_id
  FROM "document_payment"
  WHERE "method"::text IN ('tarjeta', 'transferencia')
  GROUP BY document_id
  HAVING COUNT(*) > 1
) m
WHERE dp.document_id = m.document_id
  AND dp."method"::text IN ('tarjeta', 'transferencia')
  AND dp.id <> m.keep_id;

-- Recrea el enum: efectivo -> efectivo_almacen; tarjeta y transferencia -> consignacion_almacen.
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
CREATE TYPE "PaymentMethod" AS ENUM ('efectivo_almacen', 'consignacion_almacen');

ALTER TABLE "document_payment" ALTER COLUMN "method" TYPE "PaymentMethod"
USING (
  CASE "method"::text
    WHEN 'efectivo' THEN 'efectivo_almacen'
    ELSE 'consignacion_almacen'
  END
)::"PaymentMethod";

DROP TYPE "PaymentMethod_old";
