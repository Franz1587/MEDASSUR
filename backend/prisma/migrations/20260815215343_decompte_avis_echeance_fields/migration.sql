-- Compagnie: code interne repris sur le Décompte de Remboursement Maladie
ALTER TABLE "Compagnie" ADD COLUMN "code" TEXT;

-- ParametresEntreprise: code d'agence du courtier, repris sur le Décompte
ALTER TABLE "ParametresEntreprise" ADD COLUMN "codeAgence" TEXT NOT NULL DEFAULT '001';

-- PriseEnCharge: dossier sinistre santé (N° Sinistre, N° Déclaration, Nature maladie)
ALTER TABLE "PriseEnCharge" ADD COLUMN "nSinistre" TEXT;
ALTER TABLE "PriseEnCharge" ADD COLUMN "nDeclaration" TEXT;
ALTER TABLE "PriseEnCharge" ADD COLUMN "natureMaladie" TEXT;
