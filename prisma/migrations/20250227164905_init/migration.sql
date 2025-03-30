/*
  Warnings:

  - You are about to alter the column `price` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `discountedPrice` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ProductCategories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ProductSubCategories` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

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
ALTER TABLE "Product" ADD COLUMN     "category" TEXT[],
ADD COLUMN     "subCategory" TEXT[],
ALTER COLUMN "price" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "discountedPrice" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "description" DROP NOT NULL;

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "SubCategory";

-- DropTable
DROP TABLE "_ProductCategories";

-- DropTable
DROP TABLE "_ProductSubCategories";

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");
