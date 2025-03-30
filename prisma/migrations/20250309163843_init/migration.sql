/*
  Warnings:

  - You are about to drop the `FlashSale` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `endTime` to the `FlashSaleItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `FlashSaleItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `FlashSaleItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FlashSaleItem" DROP CONSTRAINT "FlashSaleItem_flashSaleId_fkey";

-- AlterTable
ALTER TABLE "FlashSaleItem" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;

-- DropTable
DROP TABLE "FlashSale";
