CREATE TABLE "LettreCle" (
  "code" TEXT NOT NULL,
  "libelle" TEXT NOT NULL,
  "valeurUnitaire" DECIMAL(18,2) NOT NULL,
  "categorieGarantie" TEXT,
  "specialite" TEXT,
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LettreCle_pkey" PRIMARY KEY ("code")
);

ALTER TABLE "PriseEnCharge" ADD COLUMN "quantite" INTEGER DEFAULT 1;
ALTER TABLE "PriseEnCharge" ADD COLUMN "lettreCleCode" TEXT;
ALTER TABLE "PriseEnCharge" ADD COLUMN "coefficient" DECIMAL(10,2);
