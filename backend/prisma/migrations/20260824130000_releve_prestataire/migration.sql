-- CreateTable
CREATE TABLE "RelevePrestataire" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "prestataireId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "dateCreation" TEXT NOT NULL,
    "montantTotal" DECIMAL(18,2) NOT NULL,
    "nbFactures" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelevePrestataire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelevePrestataire_numero_key" ON "RelevePrestataire"("numero");

-- CreateIndex
CREATE INDEX "RelevePrestataire_prestataireId_idx" ON "RelevePrestataire"("prestataireId");

-- CreateIndex
CREATE INDEX "RelevePrestataire_clientId_idx" ON "RelevePrestataire"("clientId");

-- AddForeignKey
ALTER TABLE "RelevePrestataire" ADD CONSTRAINT "RelevePrestataire_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelevePrestataire" ADD CONSTRAINT "RelevePrestataire_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Facture" ADD COLUMN "releveId" TEXT;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_releveId_fkey" FOREIGN KEY ("releveId") REFERENCES "RelevePrestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
