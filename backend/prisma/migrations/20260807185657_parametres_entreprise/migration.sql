-- CreateTable
CREATE TABLE "ParametresEntreprise" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL DEFAULT 'MedAssur',
    "sousTitre" TEXT NOT NULL DEFAULT 'Courtier d''Assurances',
    "adresse" TEXT,
    "boitePostale" TEXT NOT NULL DEFAULT 'BP 2000',
    "ville" TEXT NOT NULL DEFAULT 'Libreville',
    "pays" TEXT NOT NULL DEFAULT 'GABON',
    "telephone" TEXT NOT NULL DEFAULT '+241 01 00 00 00',
    "email" TEXT NOT NULL DEFAULT 'contact@medassur.ga',
    "siteWeb" TEXT NOT NULL DEFAULT 'www.medassur.ga',
    "couleurPrimaire" TEXT NOT NULL DEFAULT '#0f4c81',
    "couleurSecondaire" TEXT NOT NULL DEFAULT '#1f9d55',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametresEntreprise_pkey" PRIMARY KEY ("id")
);
