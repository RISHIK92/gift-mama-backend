/*
  Warnings:

  - You are about to drop the column `viewId` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `viewId` on the `CustomUpload` table. All the data in the column will be lost.
  - You are about to drop the column `viewId` on the `CustomizationTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `viewId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the `ProductView` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CustomizationTemplate" DROP CONSTRAINT "CustomizationTemplate_viewId_fkey";

-- DropForeignKey
ALTER TABLE "ProductView" DROP CONSTRAINT "ProductView_productId_fkey";

-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "viewId";

-- AlterTable
ALTER TABLE "CustomUpload" DROP COLUMN "viewId",
ALTER COLUMN "height" DROP NOT NULL,
ALTER COLUMN "originalImageUrl" DROP NOT NULL,
ALTER COLUMN "positionX" DROP NOT NULL,
ALTER COLUMN "positionY" DROP NOT NULL,
ALTER COLUMN "width" DROP NOT NULL,
ALTER COLUMN "rotation" DROP NOT NULL,
ALTER COLUMN "scale" DROP NOT NULL,
ALTER COLUMN "shape" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CustomizationTemplate" DROP COLUMN "viewId";

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "viewId";

-- DropTable
DROP TABLE "ProductView";
