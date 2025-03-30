-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address1" TEXT,
ADD COLUMN     "address2" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "pinCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "usePrimaryForWhatsApp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappNumber" TEXT;
