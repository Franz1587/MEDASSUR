-- Passeport médical (2026-09) — voir demande utilisateur : "enrichir avec
-- les fonctionnalités de passeport médical de EYONE et de Medinova de WTW".
-- Seule AssureSante est concernée par cette migration — la dérive
-- (contraintes DROP/ADD) détectée par `prisma migrate diff` sur d'autres
-- tables n'a rien à voir avec ce changement et n'est volontairement PAS
-- incluse ici.
ALTER TABLE "AssureSante" ADD COLUMN     "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "antecedentsMedicaux" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "contactUrgenceNom" TEXT,
ADD COLUMN     "contactUrgenceTelephone" TEXT,
ADD COLUMN     "groupeSanguin" TEXT,
ADD COLUMN     "traitementsEnCours" TEXT[] DEFAULT ARRAY[]::TEXT[];
