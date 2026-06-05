/*
  Warnings:

  - You are about to drop the `tax_identifications` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `document_number` to the `third_parties` table without a default value. This is not possible if the table is not empty.
  - Added the required column `document_type` to the `third_parties` table without a default value. This is not possible if the table is not empty.
  - Added the required column `person_type` to the `third_parties` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "tax_identifications" DROP CONSTRAINT "tax_identifications_third_party_id_fkey";

-- AlterTable
ALTER TABLE "third_parties" ADD COLUMN     "business_name" VARCHAR(200),
ADD COLUMN     "document_number" VARCHAR(50) NOT NULL,
ADD COLUMN     "document_type" VARCHAR(20) NOT NULL,
ADD COLUMN     "first_name" VARCHAR(100),
ADD COLUMN     "last_name" VARCHAR(100),
ADD COLUMN     "person_type" VARCHAR(10) NOT NULL;

-- DropTable
DROP TABLE "tax_identifications";
