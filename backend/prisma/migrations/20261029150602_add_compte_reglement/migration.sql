-- AlterTable
ALTER TABLE "LettreCheque" ADD COLUMN     "compteReglementId" TEXT;

-- AlterTable
ALTER TABLE "LotCheques" ADD COLUMN     "compteReglementId" TEXT;

-- CreateTable
CREATE TABLE "CompteReglement" (
    "id" TEXT NOT NULL,
    "societeId" TEXT,
    "banqueId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "compteNumero" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'Actif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompteReglement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompteReglement_banqueId_idx" ON "CompteReglement"("banqueId");

-- CreateIndex
CREATE INDEX "CompteReglement_societeId_idx" ON "CompteReglement"("societeId");

-- CreateIndex
CREATE INDEX "LettreCheque_compteReglementId_idx" ON "LettreCheque"("compteReglementId");

-- CreateIndex
CREATE INDEX "LotCheques_compteReglementId_idx" ON "LotCheques"("compteReglementId");

-- AddForeignKey
ALTER TABLE "CompteReglement" ADD CONSTRAINT "CompteReglement_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteReglement" ADD CONSTRAINT "CompteReglement_banqueId_fkey" FOREIGN KEY ("banqueId") REFERENCES "Banque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotCheques" ADD CONSTRAINT "LotCheques_compteReglementId_fkey" FOREIGN KEY ("compteReglementId") REFERENCES "CompteReglement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LettreCheque" ADD CONSTRAINT "LettreCheque_compteReglementId_fkey" FOREIGN KEY ("compteReglementId") REFERENCES "CompteReglement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
