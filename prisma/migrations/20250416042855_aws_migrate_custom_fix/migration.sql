-- DropForeignKey
ALTER TABLE "CustomizationTemplate" DROP CONSTRAINT "CustomizationTemplate_productId_fkey";

-- DropIndex
DROP INDEX "CustomizationTemplate_productId_key";

-- AddForeignKey
ALTER TABLE "CustomizationTemplate" ADD CONSTRAINT "CustomizationTemplate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
