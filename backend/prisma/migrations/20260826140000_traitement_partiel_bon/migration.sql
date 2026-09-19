-- Traitement partiel multi-prestataire d'une ligne prescrite (2026-08)

-- CreateTable
CREATE TABLE "PrescriptionLigneTraitement" (
    "id" TEXT NOT NULL,
    "prescriptionLigneId" TEXT NOT NULL,
    "prestataireId" TEXT NOT NULL,
    "priseEnChargeId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "dateTraitement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrescriptionLigneTraitement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrescriptionLigneTraitement_priseEnChargeId_key" ON "PrescriptionLigneTraitement"("priseEnChargeId");
CREATE INDEX "PrescriptionLigneTraitement_prescriptionLigneId_idx" ON "PrescriptionLigneTraitement"("prescriptionLigneId");

ALTER TABLE "PrescriptionLigneTraitement" ADD CONSTRAINT "PrescriptionLigneTraitement_prescriptionLigneId_fkey" FOREIGN KEY ("prescriptionLigneId") REFERENCES "PrescriptionLigne"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrescriptionLigneTraitement" ADD CONSTRAINT "PrescriptionLigneTraitement_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrescriptionLigneTraitement" ADD CONSTRAINT "PrescriptionLigneTraitement_priseEnChargeId_fkey" FOREIGN KEY ("priseEnChargeId") REFERENCES "PriseEnCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: quantiteTraitee
ALTER TABLE "PrescriptionLigne" ADD COLUMN "quantiteTraitee" INTEGER NOT NULL DEFAULT 0;

-- Migrate existing data: lignes déjà entièrement traitées (ancien modèle
-- 1-1) deviennent leur premier PrescriptionLigneTraitement.
INSERT INTO "PrescriptionLigneTraitement" ("id", "prescriptionLigneId", "prestataireId", "priseEnChargeId", "quantite", "dateTraitement")
SELECT gen_random_uuid()::text, "id", "prestataireTraitantId", "priseEnChargeId", "quantite", COALESCE("dateTraitement", CURRENT_TIMESTAMP)
FROM "PrescriptionLigne"
WHERE "priseEnChargeId" IS NOT NULL AND "prestataireTraitantId" IS NOT NULL;

UPDATE "PrescriptionLigne" SET "quantiteTraitee" = "quantite" WHERE "statut" = 'Traite';

-- Drop old 1-1 treatment columns (replaced by PrescriptionLigneTraitement)
ALTER TABLE "PrescriptionLigne" DROP CONSTRAINT "PrescriptionLigne_prestataireTraitantId_fkey";
ALTER TABLE "PrescriptionLigne" DROP CONSTRAINT "PrescriptionLigne_priseEnChargeId_fkey";
DROP INDEX "PrescriptionLigne_priseEnChargeId_key";
ALTER TABLE "PrescriptionLigne" DROP COLUMN "prestataireTraitantId";
ALTER TABLE "PrescriptionLigne" DROP COLUMN "priseEnChargeId";
ALTER TABLE "PrescriptionLigne" DROP COLUMN "dateTraitement";
