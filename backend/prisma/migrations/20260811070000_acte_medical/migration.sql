CREATE TABLE "ActeMedical" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "famille" TEXT NOT NULL,
    "prixDefaut" DECIMAL(18,2) NOT NULL,
    "categorieGarantie" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActeMedical_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActeMedical_libelle_famille_key" ON "ActeMedical"("libelle", "famille");
CREATE INDEX "ActeMedical_famille_idx" ON "ActeMedical"("famille");
