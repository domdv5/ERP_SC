/*
  Warnings:

  - A unique constraint covering the columns `[codeLegacy]` on the table `category` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `codeLegacy` to the `category` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "category" ADD COLUMN     "codeLegacy" CHAR(2) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "category_codeLegacy_key" ON "category"("codeLegacy");
