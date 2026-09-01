-- Reverse lookup de derivedDocuments (Prisma no indexa FKs en PostgreSQL);
-- corre en cada fila de la lista de documentos y en cada detalle de PV.
CREATE INDEX "document_source_document_id_idx" ON "document"("source_document_id");
