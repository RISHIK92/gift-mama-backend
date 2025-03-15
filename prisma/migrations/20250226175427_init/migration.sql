/*
  Warnings:

  - You are about to drop the `homeImages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "homeImages";

-- CreateTable
CREATE TABLE "HomeImages" (
    "id" SERIAL NOT NULL,
    "HeroImages" TEXT[],
    "SubImages" TEXT[],

    CONSTRAINT "HomeImages_pkey" PRIMARY KEY ("id")
);
