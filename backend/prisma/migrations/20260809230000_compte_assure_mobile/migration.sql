-- Accès mobile d'un assuré principal (2026-08) — voir ComptesMobileService.
-- Table neuve, aucun backfill nécessaire.

CREATE TABLE "CompteAssureMobile" (
    "id" TEXT NOT NULL,
    "assureId" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "doitReinitialiser" BOOLEAN NOT NULL DEFAULT true,
    "dateGeneration" TEXT NOT NULL,
    "canalEnvoi" TEXT NOT NULL,
    "statutEnvoi" TEXT NOT NULL DEFAULT 'Simulé',
    "messageSimule" TEXT NOT NULL,

    CONSTRAINT "CompteAssureMobile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompteAssureMobile_assureId_key" ON "CompteAssureMobile"("assureId");

ALTER TABLE "CompteAssureMobile" ADD CONSTRAINT "CompteAssureMobile_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
