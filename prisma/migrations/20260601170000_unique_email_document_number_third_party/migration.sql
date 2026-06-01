-- AlterTable: add unique constraints to email and document_number on third_parties
CREATE UNIQUE INDEX "third_parties_email_key" ON "third_parties"("email");
CREATE UNIQUE INDEX "third_parties_document_number_key" ON "third_parties"("document_number");
