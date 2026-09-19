-- AlterTable
ALTER TABLE "User" ADD COLUMN "clientId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "DemandeClient" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "dateDemande" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'En attente',
    "dateTraitement" TEXT,
    "gestionnaireId" TEXT,
    "motifRefus" TEXT,
    "avenantId" TEXT,
    "nom" TEXT,
    "prenom" TEXT,
    "matricule" TEXT,
    "dateNaissance" TEXT,
    "typeAssure" TEXT,
    "familleId" TEXT,
    "telephone" TEXT,
    "sexe" TEXT,
    "adresse" TEXT,
    "scolarise" BOOLEAN,
    "assureId" TEXT,
    "motifRetrait" TEXT,

    CONSTRAINT "DemandeClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandeClient_contratId_idx" ON "DemandeClient"("contratId");

-- CreateIndex
CREATE INDEX "DemandeClient_clientId_idx" ON "DemandeClient"("clientId");

-- AddForeignKey
ALTER TABLE "DemandeClient" ADD CONSTRAINT "DemandeClient_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeClient" ADD CONSTRAINT "DemandeClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeClient" ADD CONSTRAINT "DemandeClient_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeClient" ADD CONSTRAINT "DemandeClient_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeClient" ADD CONSTRAINT "DemandeClient_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
