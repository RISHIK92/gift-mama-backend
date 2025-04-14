/*
  Warnings:

  - You are about to drop the column `customizationImageUrl` on the `CartItem` table. All the data in the column will be lost.
  - The `customizationImageUrl` column on the `OrderItem` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "customizationImageUrl",
ADD COLUMN     "customizationImageUrls" TEXT[];

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "customizationImageUrl",
ADD COLUMN     "customizationImageUrl" TEXT[];
