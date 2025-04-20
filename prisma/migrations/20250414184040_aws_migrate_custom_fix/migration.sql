/*
  Warnings:

  - You are about to drop the column `editorHeight` on the `Mask` table. All the data in the column will be lost.
  - You are about to drop the column `editorWidth` on the `Mask` table. All the data in the column will be lost.
  - You are about to drop the column `minHeight` on the `Mask` table. All the data in the column will be lost.
  - You are about to drop the column `minWidth` on the `Mask` table. All the data in the column will be lost.
  - You are about to drop the column `positionX` on the `Mask` table. All the data in the column will be lost.
  - You are about to drop the column `positionY` on the `Mask` table. All the data in the column will be lost.
  - You are about to drop the column `svgPath` on the `Mask` table. All the data in the column will be lost.
  - Added the required column `maskImageUrl` to the `Mask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `Mask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `svgData` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Mask_name_key";

-- AlterTable
ALTER TABLE "CustomUpload" ALTER COLUMN "maskId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Mask" DROP COLUMN "editorHeight",
DROP COLUMN "editorWidth",
DROP COLUMN "minHeight",
DROP COLUMN "minWidth",
DROP COLUMN "positionX",
DROP COLUMN "positionY",
DROP COLUMN "svgPath",
ADD COLUMN     "maskImageUrl" TEXT NOT NULL,
ADD COLUMN     "productId" INTEGER NOT NULL,
ALTER COLUMN "width" DROP DEFAULT,
ALTER COLUMN "height" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "svgData" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Mask" ADD CONSTRAINT "Mask_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
