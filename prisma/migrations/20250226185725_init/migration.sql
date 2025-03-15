/*
  Warnings:

  - The `OccasionName` column on the `Occasion` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Occasion" DROP COLUMN "OccasionName",
ADD COLUMN     "OccasionName" TEXT[];
