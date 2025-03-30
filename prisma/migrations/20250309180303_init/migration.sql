/*
  Warnings:

  - You are about to drop the `SubCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "SubCategory";

-- CreateTable
CREATE TABLE "AllCategories" (
    "id" SERIAL NOT NULL,
    "categories" TEXT[],
    "occasions" TEXT[],

    CONSTRAINT "AllCategories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllCategories_categories_key" ON "AllCategories"("categories");
