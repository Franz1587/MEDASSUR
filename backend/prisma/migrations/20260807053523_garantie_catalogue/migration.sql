-- CreateTable
CREATE TABLE "GarantieCatalogue" (
    "id" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "tauxAssureDefaut" DECIMAL(5,2),
    "tauxAyantsDroitDefaut" DECIMAL(5,2),
    "plafondDefaut" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GarantieCatalogue_pkey" PRIMARY KEY ("id")
);
