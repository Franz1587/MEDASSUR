-- Rubrique de garantie saisie directement sur une ligne de prise en charge
-- sans acte du catalogue ("Saisie au plafond de la garantie", 2026-09).
ALTER TABLE "AccordPrealableLigne" ADD COLUMN "categorieGarantie" TEXT;
