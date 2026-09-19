-- Règle d'âge limite (2026-08) : un troisième seuil pour les enfants
-- encore scolarisés (ex. 28 ans au lieu de 21), éditable par contrat, et
-- un drapeau par enfant pour savoir lequel des deux seuils s'applique —
-- voir age-limite.util.ts.

ALTER TABLE "Contrat" ADD COLUMN "limiteAgeEnfantScolarise" INTEGER;

ALTER TABLE "AssureSante" ADD COLUMN "scolarise" BOOLEAN NOT NULL DEFAULT false;
