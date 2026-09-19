-- Contrat de test — exclu de la comptabilité/facturation réelle.
ALTER TABLE "Contrat" ADD COLUMN "estTest" BOOLEAN NOT NULL DEFAULT false;
