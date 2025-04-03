-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_appliedCouponId_fkey";

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "couponId" INTEGER,
ADD COLUMN     "discountAmount" DECIMAL(65,30) DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "couponId" INTEGER;

-- CreateIndex
CREATE INDEX "Cart_userId_idx" ON "Cart"("userId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
