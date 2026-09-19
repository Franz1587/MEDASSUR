-- AlterTable
ALTER TABLE "DemandeClient" DROP COLUMN "nom";
ALTER TABLE "DemandeClient" DROP COLUMN "prenom";
ALTER TABLE "DemandeClient" DROP COLUMN "matricule";
ALTER TABLE "DemandeClient" DROP COLUMN "dateNaissance";
ALTER TABLE "DemandeClient" DROP COLUMN "typeAssure";
ALTER TABLE "DemandeClient" DROP COLUMN "familleId";
ALTER TABLE "DemandeClient" DROP COLUMN "telephone";
ALTER TABLE "DemandeClient" DROP COLUMN "sexe";
ALTER TABLE "DemandeClient" DROP COLUMN "adresse";
ALTER TABLE "DemandeClient" DROP COLUMN "scolarise";

-- CreateTable
CREATE TABLE "DemandeClientBeneficiaire" (
    "id" TEXT NOT NULL,
    "demandeClientId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "dateNaissance" TEXT,
    "typeAssure" TEXT NOT NULL,
    "sexe" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "scolarise" BOOLEAN,
    "photo" TEXT,
    "familleId" TEXT,
    "familleRefLocale" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DemandeClientBeneficiaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandeClientBeneficiaire_demandeClientId_idx" ON "DemandeClientBeneficiaire"("demandeClientId");

-- AddForeignKey
ALTER TABLE "DemandeClientBeneficiaire" ADD CONSTRAINT "DemandeClientBeneficiaire_demandeClientId_fkey" FOREIGN KEY ("demandeClientId") REFERENCES "DemandeClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
