-- Agence paramétrable : coordonnées, responsable, statut et mentions reconnues à l'import
ALTER TABLE "Agence" ADD COLUMN "ville" TEXT;
ALTER TABLE "Agence" ADD COLUMN "adresse" TEXT;
ALTER TABLE "Agence" ADD COLUMN "telephone" TEXT;
ALTER TABLE "Agence" ADD COLUMN "email" TEXT;
ALTER TABLE "Agence" ADD COLUMN "responsable" TEXT;
ALTER TABLE "Agence" ADD COLUMN "statut" TEXT NOT NULL DEFAULT 'Actif';
ALTER TABLE "Agence" ADD COLUMN "mentionsImport" TEXT[] DEFAULT ARRAY[]::TEXT[];
