-- Consentement RGPD (2026-10)
ALTER TABLE "User" ADD COLUMN "consentementAccepteAt" TIMESTAMP(3);

-- Prix abonnement individuel par société (2026-10)
ALTER TABLE "SocieteAssurance" ADD COLUMN "prixAbonnementIndividuelXaf" INTEGER;

-- Abonnement individuel assuré radié/suspendu (2026-10)
CREATE TABLE "AbonnementIndividuel" (
    "id" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "assureId" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "montantXaf" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'Actif',
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AbonnementIndividuel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AbonnementIndividuel_assureId_idx" ON "AbonnementIndividuel"("assureId");
CREATE INDEX "AbonnementIndividuel_societeId_idx" ON "AbonnementIndividuel"("societeId");

ALTER TABLE "AbonnementIndividuel" ADD CONSTRAINT "AbonnementIndividuel_societeId_fkey"
    FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AbonnementIndividuel" ADD CONSTRAINT "AbonnementIndividuel_assureId_fkey"
    FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
