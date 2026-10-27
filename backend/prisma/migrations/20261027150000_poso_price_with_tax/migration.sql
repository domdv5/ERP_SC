-- POSO guarda ahora el precio unitario con IVA; las existentes se pasan a (base + IVA) / cantidad
UPDATE "document_item" di
SET "unit_price" = ROUND(("subtotal" + COALESCE("tax_amount", 0)) / di."quantity", 4)
FROM "document" d
WHERE d."id" = di."document_id"
  AND d."type" = 'POSO'
  AND di."quantity" > 0;
