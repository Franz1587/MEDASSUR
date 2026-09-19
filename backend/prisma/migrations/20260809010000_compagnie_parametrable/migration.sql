-- AlterTable: Compagnie gagne logo + commission par branche, perd l'ancien
-- champ `taux` (string libre, remplacé par les deux taux décimaux).
ALTER TABLE "Compagnie"
  ADD COLUMN "logo" TEXT,
  ADD COLUMN "tauxCommissionMaladie" DECIMAL(5,2),
  ADD COLUMN "tauxCommissionAssistance" DECIMAL(5,2);

-- Rapproche les compagnies déjà en base des 6 compagnies réelles opérant
-- au Gabon (préserve les compagnieId déjà référencés par des contrats
-- existants) et renseigne leur taux de commission réel (source :
-- ACCESOIRES COMPAGNIE.pdf).
UPDATE "Compagnie" SET "nom" = 'BGFI ASSURANCES', "tauxCommissionMaladie" = 15.0, "tauxCommissionAssistance" = 14.5 WHERE "id" = 'CMP-001';
UPDATE "Compagnie" SET "nom" = 'NSIA ASSURANCES', "tauxCommissionMaladie" = 20.0, "tauxCommissionAssistance" = 20.0 WHERE "id" = 'CMP-002';
UPDATE "Compagnie" SET "nom" = 'AXA', "tauxCommissionMaladie" = 20.0, "tauxCommissionAssistance" = 20.0 WHERE "id" = 'CMP-003';
UPDATE "Compagnie" SET "nom" = 'SUNU ASSURANCES', "tauxCommissionMaladie" = 20.0, "tauxCommissionAssistance" = 20.0 WHERE "id" = 'CMP-004';
UPDATE "Compagnie" SET "nom" = 'SANLAM ALLIANZ', "tauxCommissionMaladie" = 19.0, "tauxCommissionAssistance" = 19.0 WHERE "id" = 'CMP-005';
UPDATE "Compagnie" SET "nom" = 'OGAR ASSURANCES', "tauxCommissionMaladie" = 15.0, "tauxCommissionAssistance" = 14.5 WHERE "id" = 'CMP-006';

ALTER TABLE "Compagnie" DROP COLUMN "taux";

-- CreateTable
CREATE TABLE "CompagnieAccessoireTranche" (
    "id" TEXT NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "borneMin" DECIMAL(18,2) NOT NULL,
    "borneMax" DECIMAL(18,2),
    "montant" DECIMAL(18,2) NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CompagnieAccessoireTranche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompagnieSurprimeAge" (
    "id" TEXT NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER,
    "tauxPourcent" DECIMAL(5,2) NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CompagnieSurprimeAge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompagnieClauseAjustement" (
    "id" TEXT NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "spMin" DECIMAL(5,2) NOT NULL,
    "spMax" DECIMAL(5,2),
    "tauxAjustement" DECIMAL(5,2) NOT NULL,
    "description" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CompagnieClauseAjustement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompagnieTerritorialite" (
    "id" TEXT NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CompagnieTerritorialite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompagnieTauxCouverture" (
    "id" TEXT NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "tauxAmbulatoire" TEXT NOT NULL,
    "tauxHospitalisation" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CompagnieTauxCouverture_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CompagnieAccessoireTranche" ADD CONSTRAINT "CompagnieAccessoireTranche_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompagnieSurprimeAge" ADD CONSTRAINT "CompagnieSurprimeAge_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompagnieClauseAjustement" ADD CONSTRAINT "CompagnieClauseAjustement_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompagnieTerritorialite" ADD CONSTRAINT "CompagnieTerritorialite_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompagnieTauxCouverture" ADD CONSTRAINT "CompagnieTauxCouverture_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
