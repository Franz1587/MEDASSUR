-- CreateTable
CREATE TABLE "Garantie" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "tauxAssure" DECIMAL(5,2),
    "tauxAyantsDroit" DECIMAL(5,2),
    "plafond" TEXT,

    CONSTRAINT "Garantie_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Garantie" ADD CONSTRAINT "Garantie_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
