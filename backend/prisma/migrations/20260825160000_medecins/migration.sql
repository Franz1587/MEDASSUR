-- Professionnel de santé (2026-08) — remplace l'auto-relation
-- Prestataire.etablissementId (0 ligne en usage) par un vrai modèle Medecin
-- séparé, lié plusieurs-à-plusieurs aux structures (Prestataire).

ALTER TABLE "Prestataire" DROP CONSTRAINT IF EXISTS "Prestataire_etablissementId_fkey";
ALTER TABLE "Prestataire" DROP COLUMN IF EXISTS "etablissementId";

CREATE TABLE "Medecin" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "titre" TEXT,
    "specialite" TEXT,
    "codePraticien" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medecin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Medecin_nom_idx" ON "Medecin"("nom");

CREATE TABLE "MedecinPrestataire" (
    "medecinId" TEXT NOT NULL,
    "prestataireId" TEXT NOT NULL,

    CONSTRAINT "MedecinPrestataire_pkey" PRIMARY KEY ("medecinId","prestataireId")
);

ALTER TABLE "MedecinPrestataire" ADD CONSTRAINT "MedecinPrestataire_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedecinPrestataire" ADD CONSTRAINT "MedecinPrestataire_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BordereauReglement" ADD COLUMN "medecinId" TEXT;
ALTER TABLE "BordereauReglement" ADD CONSTRAINT "BordereauReglement_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
