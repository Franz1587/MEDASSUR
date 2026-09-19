-- AlterTable
ALTER TABLE "Contrat" ADD COLUMN     "exerciceNumero" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "periodicite" TEXT NOT NULL DEFAULT 'Annuel',
ADD COLUMN     "typeAffaire" TEXT NOT NULL DEFAULT 'Affaire Nouvelle';
