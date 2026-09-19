-- Changement de mot de passe imposé à la première connexion (2026-09).
-- Défaut false pour ne pas bloquer les comptes déjà actifs et utilisés au
-- quotidien — ne s'applique qu'aux prochains mots de passe fixés par un
-- tiers (création, réinitialisation admin, régénération d'accès mobile...).
ALTER TABLE "User" ADD COLUMN "doitChangerMotDePasse" BOOLEAN NOT NULL DEFAULT false;
