-- Identité de société : logo, modèle de carte, préfixe matricule (2026-09).
CREATE TABLE "ModeleCarte" (
  "id" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "description" TEXT,
  "imageRecto" TEXT,
  "imageVerso" TEXT,
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModeleCarte_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ModeleCarte" ("id", "nom", "description", "actif")
VALUES ('classique', 'Classique (par défaut)', 'Mise en page générée par l''application — aucune image importée.', true);

ALTER TABLE "ParametresEntreprise" ADD COLUMN "logo" TEXT;
ALTER TABLE "ParametresEntreprise" ADD COLUMN "prefixeMatricule" TEXT;
ALTER TABLE "ParametresEntreprise" ADD COLUMN "modeleCarteId" TEXT;

ALTER TABLE "ParametresEntreprise" ADD CONSTRAINT "ParametresEntreprise_modeleCarteId_fkey"
  FOREIGN KEY ("modeleCarteId") REFERENCES "ModeleCarte"("id") ON DELETE SET NULL ON UPDATE CASCADE;
