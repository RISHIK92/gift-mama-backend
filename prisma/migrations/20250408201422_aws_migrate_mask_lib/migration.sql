/*
  Warnings:

  - You are about to drop the column `couponId` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `subCategory` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `occasionImages` on the `Occasion` table. All the data in the column will be lost.
  - You are about to drop the column `occasionName` on the `Occasion` table. All the data in the column will be lost.
  - You are about to drop the column `couponId` on the `Order` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `walletAmount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `price` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to drop the column `svgTemplate` on the `Product` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `balance` on the `Wallet` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `amount` on the `WalletOrder` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to drop the `AllCategories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NavCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Occasions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Recipients` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Occasion` will be added. If there are existing duplicate values, this will fail.
  - Made the column `couponDiscountAmount` on table `Cart` required. This step will fail if there are existing NULL values in that column.
  - Made the column `deliveryFee` on table `Cart` required. This step will fail if there are existing NULL values in that column.
  - Made the column `discountAmount` on table `Cart` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `name` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Occasion` table without a default value. This is not possible if the table is not empty.
  - Made the column `couponDiscountAmount` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `deliveryFee` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_couponId_fkey";

-- DropIndex
DROP INDEX "Category_category_key";

-- AlterTable
ALTER TABLE "Cart" DROP COLUMN "couponId",
ADD COLUMN     "isInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
ALTER COLUMN "couponDiscountAmount" SET NOT NULL,
ALTER COLUMN "deliveryFee" SET NOT NULL,
ALTER COLUMN "discountAmount" SET NOT NULL;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "customSvgData" TEXT,
ADD COLUMN     "customText" TEXT,
ADD COLUMN     "selectedMaskId" INTEGER;

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "category",
DROP COLUMN "subCategory",
ADD COLUMN     "isNavCategory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "subCategories" TEXT[];

-- AlterTable
ALTER TABLE "Occasion" DROP COLUMN "occasionImages",
DROP COLUMN "occasionName",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "couponId",
ADD COLUMN     "isInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "walletAmount" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "couponDiscountAmount" SET NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "customSvgData" TEXT,
ADD COLUMN     "customText" TEXT,
ADD COLUMN     "selectedMaskId" INTEGER,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "svgTemplate",
ADD COLUMN     "isInclusive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "svg" TEXT,
ADD COLUMN     "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "youtubeLink" TEXT,
ALTER COLUMN "deliveryFee" SET NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "WalletOrder" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(65,30);

-- DropTable
DROP TABLE "AllCategories";

-- DropTable
DROP TABLE "Categories";

-- DropTable
DROP TABLE "NavCategory";

-- DropTable
DROP TABLE "Occasions";

-- DropTable
DROP TABLE "Recipients";

-- CreateTable
CREATE TABLE "MaskLibrary" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "svgPath" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaskLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMask" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "maskId" INTEGER NOT NULL,
    "positionX" INTEGER NOT NULL DEFAULT 0,
    "positionY" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserUpload" (
    "id" SERIAL NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER,
    "maskId" INTEGER,
    "cartItemId" INTEGER,
    "orderItemId" INTEGER,
    "customData" JSONB,

    CONSTRAINT "UserUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductMask_productId_maskId_key" ON "ProductMask"("productId", "maskId");

-- CreateIndex
CREATE UNIQUE INDEX "UserUpload_cartItemId_key" ON "UserUpload"("cartItemId");

-- CreateIndex
CREATE UNIQUE INDEX "UserUpload_orderItemId_key" ON "UserUpload"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipient_name_key" ON "Recipient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Occasion_name_key" ON "Occasion"("name");

-- AddForeignKey
ALTER TABLE "ProductMask" ADD CONSTRAINT "ProductMask_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMask" ADD CONSTRAINT "ProductMask_maskId_fkey" FOREIGN KEY ("maskId") REFERENCES "MaskLibrary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUpload" ADD CONSTRAINT "UserUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUpload" ADD CONSTRAINT "UserUpload_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUpload" ADD CONSTRAINT "UserUpload_maskId_fkey" FOREIGN KEY ("maskId") REFERENCES "MaskLibrary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUpload" ADD CONSTRAINT "UserUpload_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUpload" ADD CONSTRAINT "UserUpload_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_appliedCouponId_fkey" FOREIGN KEY ("appliedCouponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
