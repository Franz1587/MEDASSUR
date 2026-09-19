-- Dérogation de saisie post-résiliation (2026-09) — voir demande utilisateur :
-- "si un contrat est résilié, toutes sa population passe en inactif. Seules
-- les prestations faites avant la date de résiliation peuvent être
-- saisies... sauf si l'administrateur ouvre temporairement."
ALTER TABLE "Contrat" ADD COLUMN "saisieApresResiliationAutorisee" BOOLEAN NOT NULL DEFAULT false;
