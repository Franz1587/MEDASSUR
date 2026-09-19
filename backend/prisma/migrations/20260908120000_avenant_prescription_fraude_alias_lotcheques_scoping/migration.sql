-- Cloisonnement multi-tenant (2026-09) — comblé après coup, même bug que
-- Conversation : ces 6 modèles étaient interrogés SANS AUCUN filtrage (2
-- d'entre eux, LotCheques et Prescription/traiter(), permettaient même une
-- ÉCRITURE cross-société, pas seulement une lecture).

-- Avenant porte contratId : backfill précis par JOIN.
ALTER TABLE "Avenant" ADD COLUMN "societeId" TEXT;
UPDATE "Avenant" a
SET "societeId" = COALESCE(c."societeId", 'societe-bootstrap')
FROM "Contrat" c
WHERE c.id = a."contratId";
UPDATE "Avenant" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;
CREATE INDEX "Avenant_societeId_idx" ON "Avenant"("societeId");
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prescription porte priseEnChargeId (1:1, PriseEnCharge déjà cloisonné) :
-- backfill précis par JOIN.
ALTER TABLE "Prescription" ADD COLUMN "societeId" TEXT;
UPDATE "Prescription" p
SET "societeId" = COALESCE(pec."societeId", 'societe-bootstrap')
FROM "PriseEnCharge" pec
WHERE pec.id = p."priseEnChargeId";
UPDATE "Prescription" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;
CREATE INDEX "Prescription_societeId_idx" ON "Prescription"("societeId");
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PrestataireAlias porte prestataireId (Prestataire déjà cloisonné) :
-- backfill précis par JOIN. `nomOrigine` devient unique PAR société (plus
-- globalement) — deux sociétés peuvent légitimement avoir chacune un
-- prestataire dont le nom d'origine (fichier importé) coïncide.
ALTER TABLE "PrestataireAlias" ADD COLUMN "societeId" TEXT;
UPDATE "PrestataireAlias" pa
SET "societeId" = COALESCE(p."societeId", 'societe-bootstrap')
FROM "Prestataire" p
WHERE p.id = pa."prestataireId";
UPDATE "PrestataireAlias" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;
DROP INDEX "PrestataireAlias_nomOrigine_key";
CREATE UNIQUE INDEX "PrestataireAlias_societeId_nomOrigine_key" ON "PrestataireAlias"("societeId", "nomOrigine");
CREATE INDEX "PrestataireAlias_societeId_idx" ON "PrestataireAlias"("societeId");
ALTER TABLE "PrestataireAlias" ADD CONSTRAINT "PrestataireAlias_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- LotCheques porte banqueId (Banque déjà cloisonné) : backfill précis par
-- JOIN.
ALTER TABLE "LotCheques" ADD COLUMN "societeId" TEXT;
UPDATE "LotCheques" l
SET "societeId" = COALESCE(b."societeId", 'societe-bootstrap')
FROM "Banque" b
WHERE b.id = l."banqueId";
UPDATE "LotCheques" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;
CREATE INDEX "LotCheques_societeId_idx" ON "LotCheques"("societeId");
ALTER TABLE "LotCheques" ADD CONSTRAINT "LotCheques_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ScoringFraude (cibleId polymorphe Assuré|Prestataire, pas de JOIN fiable)
-- / FactureEnAttente (aucun lien vers un modèle déjà cloisonné) :
-- rattachés en bloc à 'societe-bootstrap'.
ALTER TABLE "ScoringFraude" ADD COLUMN "societeId" TEXT;
UPDATE "ScoringFraude" SET "societeId" = 'societe-bootstrap';
CREATE INDEX "ScoringFraude_societeId_idx" ON "ScoringFraude"("societeId");
ALTER TABLE "ScoringFraude" ADD CONSTRAINT "ScoringFraude_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FactureEnAttente" ADD COLUMN "societeId" TEXT;
UPDATE "FactureEnAttente" SET "societeId" = 'societe-bootstrap';
CREATE INDEX "FactureEnAttente_societeId_idx" ON "FactureEnAttente"("societeId");
ALTER TABLE "FactureEnAttente" ADD CONSTRAINT "FactureEnAttente_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
