-- CreateTable
CREATE TABLE "Occasion" (
    "id" SERIAL NOT NULL,
    "OccasionName" TEXT NOT NULL,
    "SubImages" TEXT[],

    CONSTRAINT "Occasion_pkey" PRIMARY KEY ("id")
);
