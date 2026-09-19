-- AlterTable
ALTER TABLE "Contrat" DROP COLUMN "garanties",
ADD COLUMN "tauxCouvertureAmbulatoire" TEXT,
ADD COLUMN "tauxCouvertureHospitalisation" TEXT,
ADD COLUMN "population" INTEGER,
ADD COLUMN "primeParPersonne" DECIMAL(18,2),
ADD COLUMN "tauxAccessoires" DECIMAL(5,2),
ADD COLUMN "primeNette" DECIMAL(18,2),
ADD COLUMN "montantTaxe" DECIMAL(18,2),
ADD COLUMN "montantAccessoires" DECIMAL(18,2);
