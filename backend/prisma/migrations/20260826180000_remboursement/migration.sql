-- CreateTable
CREATE TABLE "Remboursement" (
    "id" TEXT NOT NULL,
    "beneficiaire" TEXT NOT NULL,
    "assurePrincipalId" TEXT,
    "contratId" TEXT NOT NULL,
    "dateDeclaration" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'En saisie',
    "motifAnnulation" TEXT,
    "gestionnaireId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Remboursement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Remboursement_contratId_idx" ON "Remboursement"("contratId");
CREATE INDEX "Remboursement_assurePrincipalId_idx" ON "Remboursement"("assurePrincipalId");

ALTER TABLE "Remboursement" ADD CONSTRAINT "Remboursement_assurePrincipalId_fkey" FOREIGN KEY ("assurePrincipalId") REFERENCES "AssureSante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Remboursement" ADD CONSTRAINT "Remboursement_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Remboursement" ADD CONSTRAINT "Remboursement_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "PriseEnCharge" ADD COLUMN "remboursementId" TEXT;

CREATE INDEX "PriseEnCharge_remboursementId_idx" ON "PriseEnCharge"("remboursementId");

ALTER TABLE "PriseEnCharge" ADD CONSTRAINT "PriseEnCharge_remboursementId_fkey" FOREIGN KEY ("remboursementId") REFERENCES "Remboursement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
