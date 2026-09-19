-- Toute entente préalable (AccordPrealable) se rapporte à un prestataire
-- précis, comme une PriseEnCharge — même dualité texte libre (toujours
-- renseigné) + lien optionnel vers le catalogue Prestataire. Backfill des
-- lignes déjà en base depuis une PriseEnCharge déjà rattachée si elle
-- existe (accord honoré), sinon un texte de repli explicite.

ALTER TABLE "AccordPrealable" ADD COLUMN "prestataire" TEXT;
ALTER TABLE "AccordPrealable" ADD COLUMN "prestataireId" TEXT;

UPDATE "AccordPrealable" ap
SET
  "prestataire" = COALESCE((SELECT pc."prestataire" FROM "PriseEnCharge" pc WHERE pc."accordPrealableId" = ap."id" LIMIT 1), 'Non renseigné'),
  "prestataireId" = (SELECT pc."prestataireId" FROM "PriseEnCharge" pc WHERE pc."accordPrealableId" = ap."id" LIMIT 1);

ALTER TABLE "AccordPrealable" ALTER COLUMN "prestataire" SET NOT NULL;
