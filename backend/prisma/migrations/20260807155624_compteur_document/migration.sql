-- AlterTable
ALTER TABLE "Avenant" ADD COLUMN     "numeroQuittance" INTEGER;

-- AlterTable
ALTER TABLE "Contrat" ADD COLUMN     "numeroQuittance" INTEGER;

-- CreateTable
CREATE TABLE "CompteurDocument" (
    "id" TEXT NOT NULL,
    "valeur" INTEGER NOT NULL,

    CONSTRAINT "CompteurDocument_pkey" PRIMARY KEY ("id")
);
