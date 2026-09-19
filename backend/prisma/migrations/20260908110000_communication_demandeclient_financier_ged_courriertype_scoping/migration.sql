-- Cloisonnement multi-tenant (2026-09) — comblé après coup, même bug que
-- Conversation : ces 6 modèles étaient interrogés SANS AUCUN filtrage.

-- DemandeClient porte clientId : backfill précis par JOIN.
ALTER TABLE "DemandeClient" ADD COLUMN "societeId" TEXT;
UPDATE "DemandeClient" d
SET "societeId" = COALESCE(c."societeId", 'societe-bootstrap')
FROM "Client" c
WHERE c.id = d."clientId";
UPDATE "DemandeClient" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;
CREATE INDEX "DemandeClient_societeId_idx" ON "DemandeClient"("societeId");
ALTER TABLE "DemandeClient" ADD CONSTRAINT "DemandeClient_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FondsDeRoulement / HonorairesGestion portent contratId : backfill précis
-- par JOIN.
ALTER TABLE "FondsDeRoulement" ADD COLUMN "societeId" TEXT;
UPDATE "FondsDeRoulement" f
SET "societeId" = COALESCE(c."societeId", 'societe-bootstrap')
FROM "Contrat" c
WHERE c.id = f."contratId";
UPDATE "FondsDeRoulement" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;
CREATE INDEX "FondsDeRoulement_societeId_idx" ON "FondsDeRoulement"("societeId");
ALTER TABLE "FondsDeRoulement" ADD CONSTRAINT "FondsDeRoulement_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HonorairesGestion" ADD COLUMN "societeId" TEXT;
UPDATE "HonorairesGestion" h
SET "societeId" = COALESCE(c."societeId", 'societe-bootstrap')
FROM "Contrat" c
WHERE c.id = h."contratId";
UPDATE "HonorairesGestion" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;
CREATE INDEX "HonorairesGestion_societeId_idx" ON "HonorairesGestion"("societeId");
ALTER TABLE "HonorairesGestion" ADD CONSTRAINT "HonorairesGestion_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Communication (destinataireId polymorphe selon destinataireType, pas de
-- JOIN fiable possible) / GedDocument / CourrierType (aucun lien vers un
-- modèle déjà cloisonné) : rattachés en bloc à 'societe-bootstrap', comme
-- CompteBancaire/FluxTresorerie/JournalEntry dans la migration précédente.
ALTER TABLE "Communication" ADD COLUMN "societeId" TEXT;
UPDATE "Communication" SET "societeId" = 'societe-bootstrap';
CREATE INDEX "Communication_societeId_idx" ON "Communication"("societeId");
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GedDocument" ADD COLUMN "societeId" TEXT;
UPDATE "GedDocument" SET "societeId" = 'societe-bootstrap';
CREATE INDEX "GedDocument_societeId_idx" ON "GedDocument"("societeId");
ALTER TABLE "GedDocument" ADD CONSTRAINT "GedDocument_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourrierType" ADD COLUMN "societeId" TEXT;
UPDATE "CourrierType" SET "societeId" = 'societe-bootstrap';
CREATE INDEX "CourrierType_societeId_idx" ON "CourrierType"("societeId");
ALTER TABLE "CourrierType" ADD CONSTRAINT "CourrierType_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
