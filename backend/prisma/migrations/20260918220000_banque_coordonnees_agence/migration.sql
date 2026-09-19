-- Coordonnées de l'agence bancaire (2026-09) — voir demande utilisateur sur
-- la Lettre chèque : l'encadré gauche du modèle de référence restait
-- presque vide faute de ces champs.
ALTER TABLE "Banque" ADD COLUMN     "adresse" TEXT,
ADD COLUMN     "telephone" TEXT,
ADD COLUMN     "ville" TEXT;
