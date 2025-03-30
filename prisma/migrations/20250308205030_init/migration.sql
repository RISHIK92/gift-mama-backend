/*
  Warnings:

  - You are about to drop the column `navCategories` on the `Category` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Category" DROP COLUMN "navCategories";

-- CreateTable
CREATE TABLE "NavCategory" (
    "id" SERIAL NOT NULL,
    "navCategory" TEXT NOT NULL,

    CONSTRAINT "NavCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NavCategory_navCategory_key" ON "NavCategory"("navCategory");
