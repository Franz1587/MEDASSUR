-- AlterTable: Avenant absorbe les champs de calcul de prime (mêmes que
-- Contrat) et les champs propres à Renouvellement/Résiliation.
ALTER TABLE "Avenant"
  ADD COLUMN "dateFin" TEXT,
  ADD COLUMN "nombreAssuresPrincipaux" INTEGER,
  ADD COLUMN "primeUnitaireAssurePrincipal" DECIMAL(18,2),
  ADD COLUMN "nombreConjoints" INTEGER,
  ADD COLUMN "primeUnitaireConjoint" DECIMAL(18,2),
  ADD COLUMN "nombreEnfants" INTEGER,
  ADD COLUMN "primeUnitaireEnfant" DECIMAL(18,2),
  ADD COLUMN "nombreCouples" INTEGER,
  ADD COLUMN "primeUnitaireCouple" DECIMAL(18,2),
  ADD COLUMN "tauxMinoMajoration" DECIMAL(5,2),
  ADD COLUMN "tauxReductionCommerciale" DECIMAL(5,2),
  ADD COLUMN "montantAccessoires" DECIMAL(18,2),
  ADD COLUMN "tauxCommission" DECIMAL(5,2),
  ADD COLUMN "primeNette" DECIMAL(18,2),
  ADD COLUMN "primeTotaleHT" DECIMAL(18,2),
  ADD COLUMN "montantTaxe" DECIMAL(18,2),
  ADD COLUMN "montantCommission" DECIMAL(18,2),
  ADD COLUMN "sinistralite" TEXT,
  ADD COLUMN "motif" TEXT,
  ADD COLUMN "ristourne" DECIMAL(18,2),
  ADD COLUMN "initiateur" TEXT;

-- Migration des données : Renouvellement -> Avenant (type "Renouvellement")
INSERT INTO "Avenant" (
  "id", "contratId", "type", "description", "primeAvant", "primeApres",
  "dateEffet", "dateFin", "statut", "sinistralite", "createdAt"
)
SELECT
  r."id",
  r."contratId",
  'Renouvellement',
  'Renouvellement — sinistralité ' || r."sinistralite",
  r."primeActuelle",
  r."primeProposee",
  c."dateFin",
  NULL,
  CASE r."statut" WHEN 'Renouvelé' THEN 'Appliqué' ELSE r."statut" END,
  r."sinistralite",
  NOW()
FROM "Renouvellement" r
JOIN "Contrat" c ON c."id" = r."contratId";

-- Migration des données : Resiliation -> Avenant (type "Résiliation")
INSERT INTO "Avenant" (
  "id", "contratId", "type", "description", "primeAvant", "primeApres",
  "dateEffet", "statut", "motif", "ristourne", "initiateur", "createdAt"
)
SELECT
  r."id",
  r."contratId",
  'Résiliation',
  'Résiliation — ' || r."motif",
  c."prime",
  c."prime" - r."ristourne",
  r."dateEffet",
  CASE r."statut" WHEN 'Effective' THEN 'Appliqué' WHEN 'Validée' THEN 'Validé' ELSE 'Brouillon' END,
  r."motif",
  r."ristourne",
  r."initiateur",
  NOW()
FROM "Resiliation" r
JOIN "Contrat" c ON c."id" = r."contratId";

-- DropTable
DROP TABLE "Renouvellement";
DROP TABLE "Resiliation";
