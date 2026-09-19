-- Nature de l'affection + code CNAMGS à chaque ligne de facture (2026-08)
-- — voir demande utilisateur : "il fallait créer une rubrique nature de
-- l'affection dans la saisie de la facture et remboursement... ça
-- permettra à l'application d'avoir des données statistique réels de
-- santé... sans faire remonter ses données dans les documents
-- statistiques."

ALTER TABLE "PriseEnCharge" ADD COLUMN "codeAffection" TEXT;

CREATE INDEX "PriseEnCharge_codeAffection_idx" ON "PriseEnCharge"("codeAffection");

ALTER TABLE "PriseEnCharge" ADD CONSTRAINT "PriseEnCharge_codeAffection_fkey" FOREIGN KEY ("codeAffection") REFERENCES "CodeAffection"("code") ON DELETE SET NULL ON UPDATE CASCADE;
