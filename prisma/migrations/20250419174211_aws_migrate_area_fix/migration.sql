/*
  Warnings:

  - You are about to drop the column `customizationAreaId` on the `CustomUpload` table. All the data in the column will be lost.
  - You are about to drop the `CustomizationArea` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CustomUpload" DROP CONSTRAINT "CustomUpload_customizationAreaId_fkey";

-- DropForeignKey
ALTER TABLE "CustomizationArea" DROP CONSTRAINT "CustomizationArea_productId_fkey";

-- AlterTable
ALTER TABLE "CustomUpload" DROP COLUMN "customizationAreaId";

-- DropTable
DROP TABLE "CustomizationArea";
