-- Prime détaillée par exercice (2026-09) — voir demande utilisateur :
-- saisir les primes sur les anciennes périodes pour rendre possible le
-- calcul du S/P à ces périodes.
ALTER TABLE "Exercice" ADD COLUMN "nombreAssuresPrincipaux" INTEGER;
ALTER TABLE "Exercice" ADD COLUMN "primeUnitaireAssurePrincipal" DECIMAL(18,2);
ALTER TABLE "Exercice" ADD COLUMN "nombreConjoints" INTEGER;
ALTER TABLE "Exercice" ADD COLUMN "primeUnitaireConjoint" DECIMAL(18,2);
ALTER TABLE "Exercice" ADD COLUMN "nombreEnfants" INTEGER;
ALTER TABLE "Exercice" ADD COLUMN "primeUnitaireEnfant" DECIMAL(18,2);
ALTER TABLE "Exercice" ADD COLUMN "nombreCouples" INTEGER;
ALTER TABLE "Exercice" ADD COLUMN "primeUnitaireCouple" DECIMAL(18,2);
ALTER TABLE "Exercice" ADD COLUMN "tauxMinoMajoration" DECIMAL(5,2);
ALTER TABLE "Exercice" ADD COLUMN "tauxReductionCommerciale" DECIMAL(5,2);
ALTER TABLE "Exercice" ADD COLUMN "montantAccessoires" DECIMAL(18,2);
ALTER TABLE "Exercice" ADD COLUMN "tauxCommission" DECIMAL(5,2);
ALTER TABLE "Exercice" ADD COLUMN "montantCommission" DECIMAL(18,2);
ALTER TABLE "Exercice" ADD COLUMN "montantTaxe" DECIMAL(18,2);
ALTER TABLE "Exercice" ADD COLUMN "primeNette" DECIMAL(18,2);
ALTER TABLE "Exercice" ADD COLUMN "primeTotaleHT" DECIMAL(18,2);
