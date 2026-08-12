-- Búsqueda de productos por código: ProductsService.findAll usa
-- `contains` + `mode: 'insensitive'`, que Prisma traduce a `ILIKE '%term%'`.
-- El comodín inicial invalida cualquier índice btree (incluido el UNIQUE de
-- `code`), así que Postgres caía siempre a Seq Scan. pg_trgm + GIN sí resuelve
-- el patrón con comodín a ambos lados.
--
-- NOTA: estos índices NO se pueden declarar en schema.prisma (Prisma no soporta
-- CREATE EXTENSION ni la operator class gin_trgm_ops). Ver comentario en el
-- modelo Product del schema: un futuro `migrate diff` los verá como drift e
-- intentará dropearlos.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "product_code_trgm_idx" ON "product" USING GIN ("code" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "product_legacy_code_trgm_idx" ON "product" USING GIN ("legacy_code" gin_trgm_ops);
