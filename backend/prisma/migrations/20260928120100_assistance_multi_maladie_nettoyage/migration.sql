-- Suite de 20260928120000 : reprise des liens créés entre-temps par
-- l'ancien code, puis suppression de l'ancienne colonne.
UPDATE "Contrat" m SET "contratAssistanceId" = a."id"
FROM "Contrat" a
WHERE a."contratMaladieLieId" = m."id" AND a."branche" = 'Assistance' AND m."contratAssistanceId" IS NULL;

ALTER TABLE "Contrat" DROP CONSTRAINT IF EXISTS "Contrat_contratMaladieLieId_fkey";
ALTER TABLE "Contrat" DROP COLUMN IF EXISTS "contratMaladieLieId";
