-- CreateTable
CREATE TABLE "FactureProduction" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contratId" TEXT,
    "dateEmission" TEXT NOT NULL,
    "lieuEmission" TEXT NOT NULL DEFAULT 'Libreville',
    "referenceBonReception" TEXT,
    "referenceBonCommande" TEXT,
    "objet" TEXT NOT NULL,
    "notePaiement" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'Émise',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactureProduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactureProductionLigne" (
    "id" TEXT NOT NULL,
    "factureProductionId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "periodeDebut" TEXT,
    "periodeFin" TEXT,
    "montant" DECIMAL(18,2) NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FactureProductionLigne_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FactureProduction" ADD CONSTRAINT "FactureProduction_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureProduction" ADD CONSTRAINT "FactureProduction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureProduction" ADD CONSTRAINT "FactureProduction_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureProductionLigne" ADD CONSTRAINT "FactureProductionLigne_factureProductionId_fkey" FOREIGN KEY ("factureProductionId") REFERENCES "FactureProduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
