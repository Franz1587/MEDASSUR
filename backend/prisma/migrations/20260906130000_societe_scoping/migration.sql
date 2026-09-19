-- Phase 2 multi-tenant : cloisonnement des donnees metier par societe.
-- Voir SocieteAssurance / User.societeId (migration 20260901120000) et
-- backend/src/tenant/ (TenantContext + middleware Prisma qui exploite ces
-- colonnes automatiquement). Chaque table ci-dessous recoit une colonne
-- societeId nullable + FK + index, puis toutes les lignes existantes sont
-- rattachees a la societe bootstrap deja creee en Phase 1, pour ne rien
-- casser en attendant que chaque societe ait ses propres donnees.

-- Client
ALTER TABLE "Client" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Client" ADD CONSTRAINT "Client_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Client_societeId_idx" ON "Client"("societeId");
UPDATE "Client" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Compagnie
ALTER TABLE "Compagnie" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Compagnie" ADD CONSTRAINT "Compagnie_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Compagnie_societeId_idx" ON "Compagnie"("societeId");
UPDATE "Compagnie" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Prospect
ALTER TABLE "Prospect" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Prospect_societeId_idx" ON "Prospect"("societeId");
UPDATE "Prospect" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- AppelOffres
ALTER TABLE "AppelOffres" ADD COLUMN "societeId" TEXT;
ALTER TABLE "AppelOffres" ADD CONSTRAINT "AppelOffres_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AppelOffres_societeId_idx" ON "AppelOffres"("societeId");
UPDATE "AppelOffres" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Cotation
ALTER TABLE "Cotation" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Cotation" ADD CONSTRAINT "Cotation_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Cotation_societeId_idx" ON "Cotation"("societeId");
UPDATE "Cotation" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Contrat
ALTER TABLE "Contrat" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Contrat_societeId_idx" ON "Contrat"("societeId");
UPDATE "Contrat" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- QuittanceLibre
ALTER TABLE "QuittanceLibre" ADD COLUMN "societeId" TEXT;
ALTER TABLE "QuittanceLibre" ADD CONSTRAINT "QuittanceLibre_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "QuittanceLibre_societeId_idx" ON "QuittanceLibre"("societeId");
UPDATE "QuittanceLibre" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Sinistre
ALTER TABLE "Sinistre" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Sinistre" ADD CONSTRAINT "Sinistre_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Sinistre_societeId_idx" ON "Sinistre"("societeId");
UPDATE "Sinistre" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- AssureSante
ALTER TABLE "AssureSante" ADD COLUMN "societeId" TEXT;
ALTER TABLE "AssureSante" ADD CONSTRAINT "AssureSante_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AssureSante_societeId_idx" ON "AssureSante"("societeId");
UPDATE "AssureSante" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Prestataire
ALTER TABLE "Prestataire" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Prestataire" ADD CONSTRAINT "Prestataire_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Prestataire_societeId_idx" ON "Prestataire"("societeId");
UPDATE "Prestataire" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Medecin
ALTER TABLE "Medecin" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Medecin" ADD CONSTRAINT "Medecin_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Medecin_societeId_idx" ON "Medecin"("societeId");
UPDATE "Medecin" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- AccordPrealable
ALTER TABLE "AccordPrealable" ADD COLUMN "societeId" TEXT;
ALTER TABLE "AccordPrealable" ADD CONSTRAINT "AccordPrealable_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AccordPrealable_societeId_idx" ON "AccordPrealable"("societeId");
UPDATE "AccordPrealable" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- PriseEnCharge
ALTER TABLE "PriseEnCharge" ADD COLUMN "societeId" TEXT;
ALTER TABLE "PriseEnCharge" ADD CONSTRAINT "PriseEnCharge_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "PriseEnCharge_societeId_idx" ON "PriseEnCharge"("societeId");
UPDATE "PriseEnCharge" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Facture
ALTER TABLE "Facture" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Facture_societeId_idx" ON "Facture"("societeId");
UPDATE "Facture" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Remboursement
ALTER TABLE "Remboursement" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Remboursement" ADD CONSTRAINT "Remboursement_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Remboursement_societeId_idx" ON "Remboursement"("societeId");
UPDATE "Remboursement" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- RelevePrestataire
ALTER TABLE "RelevePrestataire" ADD COLUMN "societeId" TEXT;
ALTER TABLE "RelevePrestataire" ADD CONSTRAINT "RelevePrestataire_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "RelevePrestataire_societeId_idx" ON "RelevePrestataire"("societeId");
UPDATE "RelevePrestataire" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Decompte
ALTER TABLE "Decompte" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Decompte" ADD CONSTRAINT "Decompte_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Decompte_societeId_idx" ON "Decompte"("societeId");
UPDATE "Decompte" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- BordereauReglement
ALTER TABLE "BordereauReglement" ADD COLUMN "societeId" TEXT;
ALTER TABLE "BordereauReglement" ADD CONSTRAINT "BordereauReglement_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "BordereauReglement_societeId_idx" ON "BordereauReglement"("societeId");
UPDATE "BordereauReglement" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Banque
ALTER TABLE "Banque" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Banque" ADD CONSTRAINT "Banque_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Banque_societeId_idx" ON "Banque"("societeId");
UPDATE "Banque" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- LettreCheque
ALTER TABLE "LettreCheque" ADD COLUMN "societeId" TEXT;
ALTER TABLE "LettreCheque" ADD CONSTRAINT "LettreCheque_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "LettreCheque_societeId_idx" ON "LettreCheque"("societeId");
UPDATE "LettreCheque" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- FactureProduction
ALTER TABLE "FactureProduction" ADD COLUMN "societeId" TEXT;
ALTER TABLE "FactureProduction" ADD CONSTRAINT "FactureProduction_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "FactureProduction_societeId_idx" ON "FactureProduction"("societeId");
UPDATE "FactureProduction" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- Courrier
ALTER TABLE "Courrier" ADD COLUMN "societeId" TEXT;
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Courrier_societeId_idx" ON "Courrier"("societeId");
UPDATE "Courrier" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

-- ParametresEntreprise : cloisonnement par cle (id = societeId), pas par
-- colonne (ligne unique par societe, voir ParametresEntrepriseService). La
-- societe bootstrap recupere une copie de l'habillage historique "default"
-- pour ne rien changer visuellement pour les utilisateurs deja en place.
INSERT INTO "ParametresEntreprise" (id, nom, "sousTitre", adresse, "boitePostale", ville, pays, telephone, email, "siteWeb", "couleurPrimaire", "couleurSecondaire", "codeAgence", "updatedAt")
SELECT 'societe-bootstrap', nom, "sousTitre", adresse, "boitePostale", ville, pays, telephone, email, "siteWeb", "couleurPrimaire", "couleurSecondaire", "codeAgence", now()
FROM "ParametresEntreprise" WHERE id = 'default'
ON CONFLICT (id) DO NOTHING;
