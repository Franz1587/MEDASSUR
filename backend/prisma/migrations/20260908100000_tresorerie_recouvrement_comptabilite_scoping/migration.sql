-- Cloisonnement multi-tenant de la Trésorerie/Recouvrement/Comptabilité
-- (2026-09) — comblé après coup, même bug que Conversation : ces 4
-- modèles étaient interrogés SANS AUCUN filtrage (`findMany()` nu), toute
-- société voyait la trésorerie/les impayés/le journal comptable de TOUTES
-- les sociétés.

-- CompteBancaire / FluxTresorerie / JournalEntry n'ont aucun lien vers un
-- modèle déjà cloisonné (pas de clientId/contratId) : rattachés en bloc à
-- 'societe-bootstrap', l'unique tenant réel avant le lancement du
-- multi-tenant (donnée financière antérieure, comme le reste des données
-- historiques déjà backfillées de la même façon lors de la Phase 2).
ALTER TABLE "CompteBancaire" ADD COLUMN "societeId" TEXT;
UPDATE "CompteBancaire" SET "societeId" = 'societe-bootstrap';
CREATE INDEX "CompteBancaire_societeId_idx" ON "CompteBancaire"("societeId");
ALTER TABLE "CompteBancaire" ADD CONSTRAINT "CompteBancaire_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FluxTresorerie" ADD COLUMN "societeId" TEXT;
UPDATE "FluxTresorerie" SET "societeId" = 'societe-bootstrap';
CREATE INDEX "FluxTresorerie_societeId_idx" ON "FluxTresorerie"("societeId");
ALTER TABLE "FluxTresorerie" ADD CONSTRAINT "FluxTresorerie_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD COLUMN "societeId" TEXT;
UPDATE "JournalEntry" SET "societeId" = 'societe-bootstrap';
CREATE INDEX "JournalEntry_societeId_idx" ON "JournalEntry"("societeId");
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Impaye porte clientId : backfill précis par JOIN sur Client.societeId
-- (même méthode que Conversation), plus fiable qu'un rattachement en bloc.
ALTER TABLE "Impaye" ADD COLUMN "societeId" TEXT;
UPDATE "Impaye" i
SET "societeId" = COALESCE(c."societeId", 'societe-bootstrap')
FROM "Client" c
WHERE c.id = i."clientId";
UPDATE "Impaye" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;
CREATE INDEX "Impaye_societeId_idx" ON "Impaye"("societeId");
ALTER TABLE "Impaye" ADD CONSTRAINT "Impaye_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
