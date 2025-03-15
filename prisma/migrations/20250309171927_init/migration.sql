/*
  Warnings:

  - You are about to drop the column `flashSaleId` on the `FlashSale` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `FlashSale` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id]` on the table `FlashSale` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "FlashSale" DROP CONSTRAINT "FlashSale_productId_fkey";

-- DropIndex
DROP INDEX "FlashSale_flashSaleId_productId_key";

-- AlterTable
ALTER TABLE "FlashSale" DROP COLUMN "flashSaleId",
DROP COLUMN "productId";

-- CreateTable
CREATE TABLE "FlashSaleProduct" (
    "id" SERIAL NOT NULL,
    "flashSaleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "FlashSaleProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlashSale_id_key" ON "FlashSale"("id");

-- AddForeignKey
ALTER TABLE "FlashSaleProduct" ADD CONSTRAINT "FlashSaleProduct_flashSaleId_fkey" FOREIGN KEY ("flashSaleId") REFERENCES "FlashSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashSaleProduct" ADD CONSTRAINT "FlashSaleProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
