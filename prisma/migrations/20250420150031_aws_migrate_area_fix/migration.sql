/*
  Warnings:

  - A unique constraint covering the columns `[uploadId]` on the table `CustomUpload` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `uploadId` to the `CustomUpload` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CustomUpload" ADD COLUMN     "uploadId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CustomUpload_uploadId_key" ON "CustomUpload"("uploadId");
