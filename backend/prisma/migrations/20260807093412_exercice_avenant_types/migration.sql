-- AlterTable
ALTER TABLE "Avenant" ADD COLUMN     "exerciceNumero" INTEGER;

-- CreateTable
CREATE TABLE "Exercice" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "dateDebut" TEXT NOT NULL,
    "dateFin" TEXT NOT NULL,
    "periodicite" TEXT NOT NULL,
    "prime" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exercice_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Exercice" ADD CONSTRAINT "Exercice_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
