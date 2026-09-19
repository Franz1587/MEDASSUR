-- Seuls Client.nom (souscripteur) et AssureSante.nom/prenom (assuré) restent
-- obligatoires à la saisie (2026-09) — voir demande utilisateur : "à part le
-- nom et prénom pour les assurés et les nom tout court pour les
-- souscripteurs, il ne faut pas rendre les autres données obligatoire."
-- Prestataire.secteur reste volontairement NULLABLE (déjà le cas) mais
-- continue d'être exigé au niveau applicatif (DTO/formulaire) — exception
-- documentée dans create-prestataire.dto.ts (bug taux de remboursement
-- manquant, 2026-08).

ALTER TABLE "Client" ALTER COLUMN "type" DROP NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "pays" DROP NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "contact" DROP NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "tel" DROP NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "statut" DROP NOT NULL;

ALTER TABLE "Prestataire" ALTER COLUMN "type" DROP NOT NULL;
ALTER TABLE "Prestataire" ALTER COLUMN "pays" DROP NOT NULL;
ALTER TABLE "Prestataire" ALTER COLUMN "ville" DROP NOT NULL;
ALTER TABLE "Prestataire" ALTER COLUMN "statutConvention" DROP NOT NULL;
