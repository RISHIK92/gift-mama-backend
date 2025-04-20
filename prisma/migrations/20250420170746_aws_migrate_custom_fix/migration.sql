/*
  Warnings:

  - You are about to drop the column `customizationTemplateId` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `uploadId` on the `CustomUpload` table. All the data in the column will be lost.
  - You are about to drop the column `imageCount` on the `CustomizationTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `textCount` on the `CustomizationTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `customizationTemplateId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the `CustomizationArea` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CustomizationDetail` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CustomizationArea" DROP CONSTRAINT "CustomizationArea_templateId_fkey";

-- DropForeignKey
ALTER TABLE "CustomizationDetail" DROP CONSTRAINT "CustomizationDetail_cartItemId_fkey";

-- DropForeignKey
ALTER TABLE "CustomizationDetail" DROP CONSTRAINT "CustomizationDetail_orderItemId_fkey";

-- DropIndex
DROP INDEX "CustomUpload_uploadId_key";

-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "customizationTemplateId",
ADD COLUMN     "customTemplateId" INTEGER,
ADD COLUMN     "customizationDetails" JSONB,
ADD COLUMN     "customizationImageUrls" TEXT[];

-- AlterTable
ALTER TABLE "CustomUpload" DROP COLUMN "uploadId",
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "originalImageUrl" TEXT,
ADD COLUMN     "placementInfo" JSONB,
ADD COLUMN     "positionX" INTEGER,
ADD COLUMN     "positionY" INTEGER,
ADD COLUMN     "templateId" INTEGER,
ADD COLUMN     "usedInCartItems" TEXT[],
ADD COLUMN     "usedInOrders" TEXT[],
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "CustomizationTemplate" DROP COLUMN "imageCount",
DROP COLUMN "textCount";

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "customizationTemplateId",
ADD COLUMN     "customTemplateId" INTEGER,
ADD COLUMN     "customizationDetails" TEXT,
ADD COLUMN     "customizationImageUrl" TEXT[];

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "customizationOptions" JSONB,
ADD COLUMN     "isCustomizable" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "CustomizationArea";

-- DropTable
DROP TABLE "CustomizationDetail";
