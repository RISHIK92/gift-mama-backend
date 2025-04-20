/*
  Warnings:

  - You are about to drop the column `customizationDetails` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `customizationImageUrls` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `customizationDetails` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `customizationImageUrl` on the `OrderItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "customizationDetails",
DROP COLUMN "customizationImageUrls",
ADD COLUMN     "customizationTemplateId" INTEGER;

-- AlterTable
ALTER TABLE "CustomizationTemplate" ADD COLUMN     "imageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "textCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "customizationDetails",
DROP COLUMN "customizationImageUrl",
ADD COLUMN     "customizationTemplateId" INTEGER;

-- CreateTable
CREATE TABLE "CustomizationArea" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "positionX" INTEGER NOT NULL DEFAULT 0,
    "positionY" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomizationArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationDetail" (
    "id" SERIAL NOT NULL,
    "cartItemId" INTEGER,
    "orderItemId" INTEGER,
    "areaId" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "textContent" TEXT,
    "uploadId" INTEGER,

    CONSTRAINT "CustomizationDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomizationArea_templateId_orderIndex_idx" ON "CustomizationArea"("templateId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "CustomizationDetail_cartItemId_areaId_key" ON "CustomizationDetail"("cartItemId", "areaId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomizationDetail_orderItemId_areaId_key" ON "CustomizationDetail"("orderItemId", "areaId");

-- AddForeignKey
ALTER TABLE "CustomizationArea" ADD CONSTRAINT "CustomizationArea_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CustomizationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationDetail" ADD CONSTRAINT "CustomizationDetail_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationDetail" ADD CONSTRAINT "CustomizationDetail_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
