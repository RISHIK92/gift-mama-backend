-- CreateTable
CREATE TABLE "Mask" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "svgPath" TEXT NOT NULL,
    "minWidth" INTEGER NOT NULL DEFAULT 400,
    "minHeight" INTEGER NOT NULL DEFAULT 400,
    "width" INTEGER NOT NULL DEFAULT 400,
    "height" INTEGER NOT NULL DEFAULT 400,
    "positionX" INTEGER NOT NULL DEFAULT 0,
    "positionY" INTEGER NOT NULL DEFAULT 0,
    "editorWidth" INTEGER NOT NULL DEFAULT 600,
    "editorHeight" INTEGER NOT NULL DEFAULT 600,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMask" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "maskId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomUpload" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "maskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mask_name_key" ON "Mask"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMask_productId_maskId_key" ON "ProductMask"("productId", "maskId");

-- AddForeignKey
ALTER TABLE "ProductMask" ADD CONSTRAINT "ProductMask_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMask" ADD CONSTRAINT "ProductMask_maskId_fkey" FOREIGN KEY ("maskId") REFERENCES "Mask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomUpload" ADD CONSTRAINT "CustomUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomUpload" ADD CONSTRAINT "CustomUpload_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
