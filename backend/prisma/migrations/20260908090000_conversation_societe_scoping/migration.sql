-- Cloisonnement multi-tenant de la messagerie (2026-09) — comblé après
-- coup : Conversation n'avait jamais de societeId, si bien que chaque
-- société voyait la file de messagerie (et le compteur de messages non
-- lus) de TOUTES les sociétés. Backfill précis via le demandeur réel
-- (Conversation.demandeurId = User.id, toujours) plutôt qu'un simple
-- rattachement de toutes les lignes existantes à 'societe-bootstrap' —
-- des sociétés créées après le lancement de la messagerie ont pu déjà
-- ouvrir leurs propres conversations.
ALTER TABLE "Conversation" ADD COLUMN "societeId" TEXT;

UPDATE "Conversation" c
SET "societeId" = COALESCE(u."societeId", 'societe-bootstrap')
FROM "User" u
WHERE u.id = c."demandeurId";

-- Filet de sécurité : un demandeur introuvable (compte supprimé depuis)
-- rattache quand même la ligne plutôt que de la laisser orpheline.
UPDATE "Conversation" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;

CREATE INDEX "Conversation_societeId_idx" ON "Conversation"("societeId");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_societeId_fkey"
  FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
