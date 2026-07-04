-- AlterTable
ALTER TABLE "PriseEnCharge" ADD COLUMN     "bordereauId" TEXT;

-- CreateTable
CREATE TABLE "BordereauReglement" (
    "id" TEXT NOT NULL,
    "prestataireId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "nbPrisesEnCharge" INTEGER NOT NULL,
    "montantTotal" DECIMAL(18,2) NOT NULL,
    "montantValide" DECIMAL(18,2),
    "statut" TEXT NOT NULL,
    "dateReception" TEXT NOT NULL,
    "datePaiement" TEXT,
    "referenceVirement" TEXT,

    CONSTRAINT "BordereauReglement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PriseEnCharge" ADD CONSTRAINT "PriseEnCharge_bordereauId_fkey" FOREIGN KEY ("bordereauId") REFERENCES "BordereauReglement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BordereauReglement" ADD CONSTRAINT "BordereauReglement_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

