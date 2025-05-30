-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "viewId" INTEGER;

-- AlterTable
ALTER TABLE "CustomUpload" ADD COLUMN     "viewId" INTEGER;

-- AlterTable
ALTER TABLE "CustomizableArea" ADD COLUMN     "allowedFormats" TEXT[] DEFAULT ARRAY['image/jpeg', 'image/png']::TEXT[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "maxFileSizeMB" DOUBLE PRECISION NOT NULL DEFAULT 5.0;

-- AlterTable
ALTER TABLE "CustomizationTemplate" ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "viewId" INTEGER,
ALTER COLUMN "svgData" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "viewId" INTEGER;

-- CreateTable
CREATE TABLE "ProductView" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "svgData" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomizationTemplate" ADD CONSTRAINT "CustomizationTemplate_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "ProductView"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
