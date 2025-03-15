/*
  Warnings:

  - You are about to drop the column `discount` on the `FlashSale` table. All the data in the column will be lost.
  - You are about to drop the column `salePrice` on the `FlashSale` table. All the data in the column will be lost.
  - You are about to drop the `FlashSaleProduct` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `description` to the `FlashSale` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FlashSaleProduct" DROP CONSTRAINT "FlashSaleProduct_flashSaleId_fkey";

-- DropForeignKey
ALTER TABLE "FlashSaleProduct" DROP CONSTRAINT "FlashSaleProduct_productId_fkey";

-- DropIndex
DROP INDEX "FlashSale_id_key";

-- AlterTable
ALTER TABLE "FlashSale" DROP COLUMN "discount",
DROP COLUMN "salePrice",
ADD COLUMN     "description" TEXT NOT NULL;

-- DropTable
DROP TABLE "FlashSaleProduct";

-- CreateTable
CREATE TABLE "FlashSaleItem" (
    "id" SERIAL NOT NULL,
    "flashSaleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "salePrice" DECIMAL(65,30) NOT NULL,
    "discount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlashSaleItem_flashSaleId_productId_key" ON "FlashSaleItem"("flashSaleId", "productId");

-- AddForeignKey
ALTER TABLE "FlashSaleItem" ADD CONSTRAINT "FlashSaleItem_flashSaleId_fkey" FOREIGN KEY ("flashSaleId") REFERENCES "FlashSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashSaleItem" ADD CONSTRAINT "FlashSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
