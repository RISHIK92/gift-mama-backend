/*
  Warnings:

  - You are about to drop the column `Advert` on the `HomeImages` table. All the data in the column will be lost.
  - You are about to drop the column `HeroImages` on the `HomeImages` table. All the data in the column will be lost.
  - You are about to drop the column `SubImages` on the `HomeImages` table. All the data in the column will be lost.
  - You are about to drop the column `SubTitle` on the `HomeImages` table. All the data in the column will be lost.
  - You are about to drop the column `Title` on the `HomeImages` table. All the data in the column will be lost.
  - You are about to drop the column `OccasionName` on the `Occasion` table. All the data in the column will be lost.
  - You are about to drop the column `SubImages` on the `Occasion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "HomeImages" DROP COLUMN "Advert",
DROP COLUMN "HeroImages",
DROP COLUMN "SubImages",
DROP COLUMN "SubTitle",
DROP COLUMN "Title",
ADD COLUMN     "advertImages" TEXT[],
ADD COLUMN     "flashSaleDescription" TEXT NOT NULL DEFAULT 'Hurry Up! Flash Sale',
ADD COLUMN     "flashSaleEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "heroImages" TEXT[],
ADD COLUMN     "heroSubtitles" TEXT[],
ADD COLUMN     "heroTitles" TEXT[];

-- AlterTable
ALTER TABLE "Occasion" DROP COLUMN "OccasionName",
DROP COLUMN "SubImages",
ADD COLUMN     "occasionImages" TEXT[],
ADD COLUMN     "occasionName" TEXT[];

-- CreateTable
CREATE TABLE "CustomSection" (
    "id" SERIAL NOT NULL,
    "homeImagesId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomSection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomSection" ADD CONSTRAINT "CustomSection_homeImagesId_fkey" FOREIGN KEY ("homeImagesId") REFERENCES "HomeImages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
