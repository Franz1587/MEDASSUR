-- Pied de page légal + coordonnées bancaires par compagnie, et numéro de
-- police par contrat (2026-08) — voir demande utilisateur.
ALTER TABLE "Compagnie" ADD COLUMN "raisonSociale" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "capitalSocial" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "rccm" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "statistique" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "adresseSiege" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "boitePostale" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "ville" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "telephone" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "fax" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "emailContact" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "siteWeb" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "banqueNom" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "banqueNumeroCompte" TEXT;

ALTER TABLE "Contrat" ADD COLUMN "numeroPolice" TEXT;
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_compagnieId_numeroPolice_key" UNIQUE ("compagnieId", "numeroPolice");
