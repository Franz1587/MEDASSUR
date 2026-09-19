-- Motifs de consultation multiples (2026-08) — voir demande utilisateur :
-- "l'application doit pouvoir faire remonter une liste des motifs, avec la
-- possibilité d'en ajouter plusieurs" — remplace le motif unique en texte
-- libre par un tableau (aucune ligne existante à ce jour).

ALTER TABLE "Prescription" DROP COLUMN "motifConsultation";
ALTER TABLE "Prescription" ADD COLUMN "motifsConsultation" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Prescription" ALTER COLUMN "motifsConsultation" DROP DEFAULT;
