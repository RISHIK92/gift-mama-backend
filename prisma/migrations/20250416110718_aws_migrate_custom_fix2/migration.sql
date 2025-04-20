-- DropForeignKey
ALTER TABLE "CustomizationTemplate" DROP CONSTRAINT "CustomizationTemplate_productId_fkey";

-- AlterTable
ALTER TABLE "CustomizationTemplate" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "CustomizationTemplate_productId_orderIndex_idx" ON "CustomizationTemplate"("productId", "orderIndex");

-- AddForeignKey
ALTER TABLE "CustomizationTemplate" ADD CONSTRAINT "CustomizationTemplate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
