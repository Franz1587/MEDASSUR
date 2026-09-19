-- AlterTable
ALTER TABLE "Contrat" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "produit" TEXT;

-- AlterTable
ALTER TABLE "Compagnie" ADD COLUMN "codeCourtier" TEXT;
