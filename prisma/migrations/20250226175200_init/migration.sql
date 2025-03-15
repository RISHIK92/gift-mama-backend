-- CreateTable
CREATE TABLE "homeImages" (
    "id" SERIAL NOT NULL,
    "HeroImages" TEXT[],
    "SubImages" TEXT[],

    CONSTRAINT "homeImages_pkey" PRIMARY KEY ("id")
);
