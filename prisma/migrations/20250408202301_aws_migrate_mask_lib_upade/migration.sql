-- CreateTable
CREATE TABLE "Categories" (
    "id" SERIAL NOT NULL,
    "categories" TEXT NOT NULL,
    "subCategories" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occasions" (
    "id" SERIAL NOT NULL,
    "occasions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Occasions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipients" (
    "id" SERIAL NOT NULL,
    "recipients" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavCategory" (
    "id" SERIAL NOT NULL,
    "navCategory" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllCategories" (
    "id" SERIAL NOT NULL,
    "categories" TEXT[],
    "occasions" TEXT[],
    "recipients" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllCategories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Categories_categories_key" ON "Categories"("categories");

-- CreateIndex
CREATE UNIQUE INDEX "Occasions_occasions_key" ON "Occasions"("occasions");

-- CreateIndex
CREATE UNIQUE INDEX "Recipients_recipients_key" ON "Recipients"("recipients");

-- CreateIndex
CREATE UNIQUE INDEX "NavCategory_navCategory_key" ON "NavCategory"("navCategory");

-- CreateIndex
CREATE UNIQUE INDEX "AllCategories_categories_key" ON "AllCategories"("categories");
