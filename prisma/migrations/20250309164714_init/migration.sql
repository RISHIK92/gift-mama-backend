/*
  Warnings:

  - You are about to drop the `FlashSaleItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FlashSaleItem" DROP CONSTRAINT "FlashSaleItem_productId_fkey";

-- DropTable
DROP TABLE "FlashSaleItem";

-- CreateTable
CREATE TABLE "FlashSale" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "flashSaleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "salePrice" DECIMAL(65,30) NOT NULL,
    "discount" DECIMAL(65,30) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlashSale_flashSaleId_productId_key" ON "FlashSale"("flashSaleId", "productId");

-- AddForeignKey
ALTER TABLE "FlashSale" ADD CONSTRAINT "FlashSale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
