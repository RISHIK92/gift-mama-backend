/*
  Warnings:

  - You are about to drop the column `placementInfo` on the `CustomUpload` table. All the data in the column will be lost.
  - You are about to drop the column `usedInCartItems` on the `CustomUpload` table. All the data in the column will be lost.
  - You are about to drop the column `usedInOrders` on the `CustomUpload` table. All the data in the column will be lost.
  - Added the required column `shape` to the `CustomUpload` table without a default value. This is not possible if the table is not empty.
  - Made the column `height` on table `CustomUpload` required. This step will fail if there are existing NULL values in that column.
  - Made the column `originalImageUrl` on table `CustomUpload` required. This step will fail if there are existing NULL values in that column.
  - Made the column `positionX` on table `CustomUpload` required. This step will fail if there are existing NULL values in that column.
  - Made the column `positionY` on table `CustomUpload` required. This step will fail if there are existing NULL values in that column.
  - Made the column `templateId` on table `CustomUpload` required. This step will fail if there are existing NULL values in that column.
  - Made the column `width` on table `CustomUpload` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CustomUpload" DROP CONSTRAINT "CustomUpload_productId_fkey";

-- DropForeignKey
ALTER TABLE "CustomUpload" DROP CONSTRAINT "CustomUpload_userId_fkey";

-- DropForeignKey
ALTER TABLE "CustomizationTemplate" DROP CONSTRAINT "CustomizationTemplate_productId_fkey";

-- DropIndex
DROP INDEX "CustomizationTemplate_productId_orderIndex_idx";

-- AlterTable
ALTER TABLE "CustomUpload" DROP COLUMN "placementInfo",
DROP COLUMN "usedInCartItems",
DROP COLUMN "usedInOrders",
ADD COLUMN     "areaId" INTEGER,
ADD COLUMN     "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "scale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "shape" TEXT NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "height" SET NOT NULL,
ALTER COLUMN "originalImageUrl" SET NOT NULL,
ALTER COLUMN "positionX" SET NOT NULL,
ALTER COLUMN "positionX" SET DEFAULT 0.0,
ALTER COLUMN "positionX" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "positionY" SET NOT NULL,
ALTER COLUMN "positionY" SET DEFAULT 0.0,
ALTER COLUMN "positionY" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "templateId" SET NOT NULL,
ALTER COLUMN "width" SET NOT NULL;

-- AlterTable
ALTER TABLE "CustomizationTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CustomizableArea" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "name" TEXT,
    "shape" TEXT NOT NULL,
    "centerX" DOUBLE PRECISION NOT NULL,
    "centerY" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "radius" DOUBLE PRECISION,
    "defaultScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "defaultRotation" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "defaultPositionX" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "defaultPositionY" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomizableArea_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomizationTemplate" ADD CONSTRAINT "CustomizationTemplate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizableArea" ADD CONSTRAINT "CustomizableArea_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CustomizationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomUpload" ADD CONSTRAINT "CustomUpload_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomUpload" ADD CONSTRAINT "CustomUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomUpload" ADD CONSTRAINT "CustomUpload_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CustomizationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomUpload" ADD CONSTRAINT "CustomUpload_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "CustomizableArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
