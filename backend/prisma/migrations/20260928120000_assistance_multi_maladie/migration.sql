-- Assistance liée à PLUSIEURS contrats Maladie (2026-09) : le lien passe
-- du contrat Assistance (contratMaladieLieId, un seul Maladie) au contrat
-- Maladie (contratAssistanceId). Colonne additive + reprise des liens
-- existants ; l'ancienne colonne est supprimée par la migration suivante,
-- une fois le nouveau code déployé.
ALTER TABLE "Contrat" ADD COLUMN "contratAssistanceId" TEXT;
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_contratAssistanceId_fkey" FOREIGN KEY ("contratAssistanceId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Contrat_contratAssistanceId_idx" ON "Contrat"("contratAssistanceId");

UPDATE "Contrat" m SET "contratAssistanceId" = a."id"
FROM "Contrat" a
WHERE a."contratMaladieLieId" = m."id" AND a."branche" = 'Assistance' AND m."contratAssistanceId" IS NULL;
