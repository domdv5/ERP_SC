/*
  Warnings:

  - You are about to drop the column `codeLegacy` on the `category` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "category_codeLegacy_key";

-- AlterTable
ALTER TABLE "category" DROP COLUMN "codeLegacy";
