-- Texte du verso de carte éditable (2026-09) — voir demande utilisateur :
-- "il faudrait que l'application puisse générer ces deux blocs de texte
-- au lieu de les laisser figés... éditables afin qu'on puisse changer
-- les informations à tout moment."
ALTER TABLE "ParametresEntreprise" ADD COLUMN "carteVersoIntro" TEXT;
ALTER TABLE "ParametresEntreprise" ADD COLUMN "carteVersoTelephone" TEXT;
