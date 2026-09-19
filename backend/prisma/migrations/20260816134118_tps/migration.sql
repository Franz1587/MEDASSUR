-- TPS (2026-08) — paramétrage par prestataire, exonération par acte,
-- montant figé par ligne.
ALTER TABLE "ActeMedical" ADD COLUMN "exonereTps" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Prestataire" ADD COLUMN "tpsAssujetti" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Prestataire" ADD COLUMN "tpsDateEffet" TEXT;
ALTER TABLE "Prestataire" ADD COLUMN "tpsDateArret" TEXT;

ALTER TABLE "PriseEnCharge" ADD COLUMN "montantTps" DECIMAL(18,2);
