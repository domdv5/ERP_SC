-- Un excedente de proveedor siempre registra quién y cuándo y no viene de una DVC (como customer_credit_excedente_chk).
ALTER TABLE "supplier_credit" ADD CONSTRAINT "supplier_credit_excedente_chk"
  CHECK ("kind" <> 'excedente' OR ("user_id" IS NOT NULL AND "date" IS NOT NULL AND "source_document_id" IS NULL));
