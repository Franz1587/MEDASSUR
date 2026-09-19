-- CreateTable
CREATE TABLE "Facture" (
    "id" TEXT NOT NULL,
    "prestataireId" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "dateReception" TEXT NOT NULL,
    "referenceFacture" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'En saisie',
    "gestionnaireId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Facture_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Facture_prestataireId_idx" ON "Facture"("prestataireId");
CREATE INDEX "Facture_contratId_idx" ON "Facture"("contratId");

ALTER TABLE "Facture" ADD CONSTRAINT "Facture_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "PriseEnCharge" ADD COLUMN "factureId" TEXT;
ALTER TABLE "PriseEnCharge" ADD COLUMN "acteMedicalId" TEXT;

CREATE INDEX "PriseEnCharge_factureId_idx" ON "PriseEnCharge"("factureId");

ALTER TABLE "PriseEnCharge" ADD CONSTRAINT "PriseEnCharge_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriseEnCharge" ADD CONSTRAINT "PriseEnCharge_acteMedicalId_fkey" FOREIGN KEY ("acteMedicalId") REFERENCES "ActeMedical"("id") ON DELETE SET NULL ON UPDATE CASCADE;
