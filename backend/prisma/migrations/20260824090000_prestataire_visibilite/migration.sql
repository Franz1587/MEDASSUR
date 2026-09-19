-- AlterTable
ALTER TABLE "Prestataire" ADD COLUMN "garantiesVisibles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "categoriesActesVisibles" TEXT[] DEFAULT ARRAY[]::TEXT[];
