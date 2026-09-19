-- PriseEnCharge et AccordPrealable gagnent un contratId dénormalisé, posé
-- une fois à la création — même principe qu'AvenantAssure.contratId : doit
-- rester rattaché au contrat réellement en vigueur au moment des faits,
-- indépendamment d'une bascule ultérieure de l'assuré vers un autre
-- contrat (voir MouvementsService.basculerVersContrat), sans quoi tout
-- l'historique de consommation semblerait rétroactivement appartenir au
-- nouveau contrat.

ALTER TABLE "PriseEnCharge" ADD COLUMN "contratId" TEXT;
UPDATE "PriseEnCharge" SET "contratId" = (SELECT "contratId" FROM "AssureSante" WHERE "AssureSante"."id" = "PriseEnCharge"."assureId");
ALTER TABLE "PriseEnCharge" ALTER COLUMN "contratId" SET NOT NULL;
CREATE INDEX "PriseEnCharge_contratId_idx" ON "PriseEnCharge"("contratId");

ALTER TABLE "AccordPrealable" ADD COLUMN "contratId" TEXT;
UPDATE "AccordPrealable" SET "contratId" = (SELECT "contratId" FROM "AssureSante" WHERE "AssureSante"."id" = "AccordPrealable"."assureId");
ALTER TABLE "AccordPrealable" ALTER COLUMN "contratId" SET NOT NULL;
CREATE INDEX "AccordPrealable_contratId_idx" ON "AccordPrealable"("contratId");
