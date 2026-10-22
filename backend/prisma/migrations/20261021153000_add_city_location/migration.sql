-- AlterTable
ALTER TABLE "customer_branch" ADD COLUMN     "city_code" VARCHAR(5);

-- AlterTable
ALTER TABLE "third_parties" ADD COLUMN     "city_code" VARCHAR(5);

-- CreateTable
CREATE TABLE "departments" (
    "code" VARCHAR(2) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "cities" (
    "code" VARCHAR(5) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "department_code" VARCHAR(2) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "cities_department_code_idx" ON "cities"("department_code");

-- AddForeignKey
ALTER TABLE "third_parties" ADD CONSTRAINT "third_parties_city_code_fkey" FOREIGN KEY ("city_code") REFERENCES "cities"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_branch" ADD CONSTRAINT "customer_branch_city_code_fkey" FOREIGN KEY ("city_code") REFERENCES "cities"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_department_code_fkey" FOREIGN KEY ("department_code") REFERENCES "departments"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

