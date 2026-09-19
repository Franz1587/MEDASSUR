-- CreateTable
CREATE TABLE "QuittanceLibre" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "montantTotal" DECIMAL(18,2) NOT NULL,
    "dateCreation" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'En cours',
    "motifAnnulation" TEXT,
    "gestionnaireId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuittanceLibre_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuittanceLibre_contratId_idx" ON "QuittanceLibre"("contratId");

ALTER TABLE "QuittanceLibre" ADD CONSTRAINT "QuittanceLibre_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuittanceLibre" ADD CONSTRAINT "QuittanceLibre_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "QuittanceLibreTranche" (
    "id" TEXT NOT NULL,
    "quittanceLibreId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "dateEcheance" TEXT NOT NULL,
    "encaissementId" TEXT,

    CONSTRAINT "QuittanceLibreTranche_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuittanceLibreTranche_encaissementId_key" ON "QuittanceLibreTranche"("encaissementId");
CREATE INDEX "QuittanceLibreTranche_quittanceLibreId_idx" ON "QuittanceLibreTranche"("quittanceLibreId");

ALTER TABLE "QuittanceLibreTranche" ADD CONSTRAINT "QuittanceLibreTranche_quittanceLibreId_fkey" FOREIGN KEY ("quittanceLibreId") REFERENCES "QuittanceLibre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuittanceLibreTranche" ADD CONSTRAINT "QuittanceLibreTranche_encaissementId_fkey" FOREIGN KEY ("encaissementId") REFERENCES "EncaissementPrime"("id") ON DELETE SET NULL ON UPDATE CASCADE;
