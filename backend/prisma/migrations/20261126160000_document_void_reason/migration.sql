-- CreateEnum
CREATE TYPE "DocumentVoidReason" AS ENUM ('cantidad_equivocada', 'producto_equivocado', 'costo_equivocado', 'proveedor_equivocado', 'cliente_equivocado', 'bodega_equivocada', 'documento_duplicado', 'operacion_no_realizada', 'otro');

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "void_reason" "DocumentVoidReason",
ADD COLUMN     "void_reason_other" VARCHAR(500);
