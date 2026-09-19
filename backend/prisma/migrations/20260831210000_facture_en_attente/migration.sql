-- Import global de factures "tous contrats confondus" — file d'attente
-- des lignes dont le matricule n'a pas encore de population chargée.
CREATE TABLE "FactureEnAttente" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "prestataire" TEXT NOT NULL,
    "referenceFacture" TEXT NOT NULL,
    "dateReception" TEXT NOT NULL,
    "typePrestation" TEXT NOT NULL,
    "datePrestation" TEXT NOT NULL,
    "acteMedical" TEXT NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "quantite" INTEGER,
    "statut" TEXT,
    "motifRejet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactureEnAttente_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FactureEnAttente_matricule_idx" ON "FactureEnAttente"("matricule");
