-- DropForeignKey
ALTER TABLE "equivalence_table" DROP CONSTRAINT "equivalence_table_category_id_fkey";

-- DropForeignKey
ALTER TABLE "equivalence_table" DROP CONSTRAINT "equivalence_table_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "payable_payments" DROP CONSTRAINT "payable_payments_account_payable_id_fkey";

-- DropForeignKey
ALTER TABLE "receivable_payments" DROP CONSTRAINT "receivable_payments_account_receivable_id_fkey";

-- DropIndex
DROP INDEX "accounts_payable_due_date_idx";

-- DropIndex
DROP INDEX "accounts_receivable_due_date_idx";

-- AlterTable
ALTER TABLE "accounts_payable" DROP COLUMN "due_date";

-- AlterTable
ALTER TABLE "accounts_receivable" DROP COLUMN "due_date";

-- DropTable
DROP TABLE "equivalence_table";

-- DropTable
DROP TABLE "payable_payments";

-- DropTable
DROP TABLE "receivable_payments";
