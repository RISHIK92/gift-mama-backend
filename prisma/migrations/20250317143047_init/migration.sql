-- CreateTable
CREATE TABLE "Categories" (
    "id" SERIAL NOT NULL,
    "categories" TEXT NOT NULL,
    "subCategories" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Categories_categories_key" ON "Categories"("categories");
