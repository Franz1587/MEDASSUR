-- PortailSocieteAcces : accès multi-clients portail prestataire (2026-10)
-- Permet à un prestataire de servir des patients couverts par PLUSIEURS
-- sociétés MEDASSUR+ (compagnies, courtiers, mutuelles) sans mélanger les données.

CREATE TABLE "PortailSocieteAcces" (
    "id" TEXT NOT NULL,
    "prestataireId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortailSocieteAcces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortailSocieteAcces_prestataireId_societeId_key"
    ON "PortailSocieteAcces"("prestataireId", "societeId");

CREATE INDEX "PortailSocieteAcces_prestataireId_idx"
    ON "PortailSocieteAcces"("prestataireId");

CREATE INDEX "PortailSocieteAcces_societeId_idx"
    ON "PortailSocieteAcces"("societeId");

ALTER TABLE "PortailSocieteAcces"
    ADD CONSTRAINT "PortailSocieteAcces_prestataireId_fkey"
    FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortailSocieteAcces"
    ADD CONSTRAINT "PortailSocieteAcces_societeId_fkey"
    FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
