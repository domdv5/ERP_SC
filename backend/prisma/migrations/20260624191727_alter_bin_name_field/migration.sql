/*
  Warnings:

  - You are about to drop the column `name` on the `bin` table. All the data in the column will be lost.
  - Added the required column `code` to the `bin` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bin" DROP COLUMN "name",
ADD COLUMN     "code" INTEGER NOT NULL;
