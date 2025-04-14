-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customizationDetails" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "customizationDetails" TEXT,
ADD COLUMN     "customizationImageUrl" TEXT;
