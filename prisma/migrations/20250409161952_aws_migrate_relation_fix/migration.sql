/*
  Warnings:

  - You are about to drop the column `isNavCategory` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Occasion` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `Occasion` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Occasion` table. All the data in the column will be lost.
  - You are about to drop the `Recipient` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[category]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `category` to the `Category` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Category_name_key";

-- DropIndex
DROP INDEX "Occasion_name_key";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "isNavCategory",
DROP COLUMN "name",
ADD COLUMN     "category" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Occasion" DROP COLUMN "description",
DROP COLUMN "images",
DROP COLUMN "name",
ADD COLUMN     "occasionImages" TEXT[],
ADD COLUMN     "occasionName" TEXT[];

-- DropTable
DROP TABLE "Recipient";

-- CreateIndex
CREATE UNIQUE INDEX "Category_category_key" ON "Category"("category");
