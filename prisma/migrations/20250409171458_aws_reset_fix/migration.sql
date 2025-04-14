/*
  Warnings:

  - You are about to drop the column `isInclusive` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `Cart` table. All the data in the column will be lost.
  - You are about to drop the column `customSvgData` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `customText` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `selectedMaskId` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `subCategories` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `isInclusive` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `Order` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `walletAmount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to drop the column `customSvgData` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `customText` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `selectedMaskId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to drop the column `isInclusive` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `svg` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `youtubeLink` on the `Product` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `balance` on the `Wallet` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `WalletOrder` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to drop the `MaskLibrary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductMask` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserUpload` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_appliedCouponId_fkey";

-- DropForeignKey
ALTER TABLE "ProductMask" DROP CONSTRAINT "ProductMask_maskId_fkey";

-- DropForeignKey
ALTER TABLE "ProductMask" DROP CONSTRAINT "ProductMask_productId_fkey";

-- DropForeignKey
ALTER TABLE "UserUpload" DROP CONSTRAINT "UserUpload_cartItemId_fkey";

-- DropForeignKey
ALTER TABLE "UserUpload" DROP CONSTRAINT "UserUpload_maskId_fkey";

-- DropForeignKey
ALTER TABLE "UserUpload" DROP CONSTRAINT "UserUpload_orderItemId_fkey";

-- DropForeignKey
ALTER TABLE "UserUpload" DROP CONSTRAINT "UserUpload_productId_fkey";

-- DropForeignKey
ALTER TABLE "UserUpload" DROP CONSTRAINT "UserUpload_userId_fkey";

-- DropForeignKey
ALTER TABLE "Wishlist" DROP CONSTRAINT "Wishlist_userId_fkey";

-- AlterTable
ALTER TABLE "Cart" DROP COLUMN "isInclusive",
DROP COLUMN "tax",
ADD COLUMN     "couponId" INTEGER,
ALTER COLUMN "couponDiscountAmount" DROP NOT NULL,
ALTER COLUMN "deliveryFee" DROP NOT NULL,
ALTER COLUMN "discountAmount" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "customSvgData",
DROP COLUMN "customText",
DROP COLUMN "selectedMaskId";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "subCategories",
ADD COLUMN     "subCategory" TEXT[];

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "isInclusive",
DROP COLUMN "tax",
ADD COLUMN     "couponId" INTEGER,
ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "walletAmount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "couponDiscountAmount" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "customSvgData",
DROP COLUMN "customText",
DROP COLUMN "selectedMaskId",
ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "isInclusive",
DROP COLUMN "svg",
DROP COLUMN "tax",
DROP COLUMN "youtubeLink",
ADD COLUMN     "svgTemplate" TEXT,
ALTER COLUMN "deliveryFee" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "balance" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "WalletOrder" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- DropTable
DROP TABLE "MaskLibrary";

-- DropTable
DROP TABLE "ProductMask";

-- DropTable
DROP TABLE "UserUpload";

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
