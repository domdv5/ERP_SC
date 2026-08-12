-- CreateEnum
CREATE TYPE "WithholdingAgentType" AS ENUM ('ninguno', 'gran_contribuyente', 'autorretenedor_renta', 'agente_retencion_iva');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('ordinario', 'rst', 'no_aplica');

-- AlterTable
ALTER TABLE "third_parties" ADD COLUMN     "iva_responsible" BOOLEAN,
ADD COLUMN     "tax_regime" "TaxRegime",
ADD COLUMN     "withholding_agent_type" "WithholdingAgentType";
