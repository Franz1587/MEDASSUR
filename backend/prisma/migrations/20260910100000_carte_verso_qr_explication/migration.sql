-- 3ᵉ bloc de texte éditable du verso (2026-09) — voir demande
-- utilisateur : "il faut aussi rendre ce texte éditable" (paragraphe
-- d'explication du QR Code).
ALTER TABLE "ParametresEntreprise" ADD COLUMN "carteVersoQrExplication" TEXT;
