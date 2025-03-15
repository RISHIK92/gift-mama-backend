/*
  Warnings:

  - You are about to drop the `_ProductCategories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ProductSubCategories` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ProductCategories" DROP CONSTRAINT "_ProductCategories_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProductCategories" DROP CONSTRAINT "_ProductCategories_B_fkey";

-- DropForeignKey
ALTER TABLE "_ProductSubCategories" DROP CONSTRAINT "_ProductSubCategories_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProductSubCategories" DROP CONSTRAINT "_ProductSubCategories_B_fkey";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "categories" TEXT[],
ADD COLUMN     "subCategories" TEXT[];

-- DropTable
DROP TABLE "_ProductCategories";

-- DropTable
DROP TABLE "_ProductSubCategories";
