-- Lettres clés : catégorie de garantie et spécialité passent de champ
-- texte unique à liste à choix multiple (tableau vide = s'applique à
-- toutes) -- voir demande utilisateur.
ALTER TABLE "LettreCle" ADD COLUMN "categoriesGarantie" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "LettreCle" ADD COLUMN "specialites" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "LettreCle" SET "categoriesGarantie" = ARRAY["categorieGarantie"]::TEXT[] WHERE "categorieGarantie" IS NOT NULL;
UPDATE "LettreCle" SET "specialites" = ARRAY["specialite"]::TEXT[] WHERE "specialite" IS NOT NULL;

-- KC/KA/K Loc s'appliquent à l'Hospitalisation ET à la Chirurgie ; K
-- (actes de spécialité) même hors hospitalisation (tableau vide = toutes
-- les catégories) -- voir demande utilisateur (annotations écran).
UPDATE "LettreCle" SET "categoriesGarantie" = ARRAY['Hospitalisation', 'Chirurgie']::TEXT[] WHERE "code" IN ('KC', 'KA', 'K Loc');
UPDATE "LettreCle" SET "categoriesGarantie" = '{}' WHERE "code" = 'K';

ALTER TABLE "LettreCle" DROP COLUMN "categorieGarantie";
ALTER TABLE "LettreCle" DROP COLUMN "specialite";
