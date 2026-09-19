-- Compteur atomique pour LettreCheque.numero — même principe que
-- decompte_numero_seq / reglement_numero_seq (jamais de doublon, jamais
-- remis à zéro).
CREATE SEQUENCE "lettre_cheque_numero_seq" START 1;

CREATE TABLE "Banque" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "codeBanque" TEXT,
    "compteNumero" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'Actif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Banque_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LotCheques" (
    "id" TEXT NOT NULL,
    "banqueId" TEXT NOT NULL,
    "numeroDebut" INTEGER NOT NULL,
    "numeroFin" INTEGER NOT NULL,
    "numeroProchain" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'Actif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotCheques_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LotCheques_banqueId_idx" ON "LotCheques"("banqueId");
ALTER TABLE "LotCheques" ADD CONSTRAINT "LotCheques_banqueId_fkey" FOREIGN KEY ("banqueId") REFERENCES "Banque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LettreCheque" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "banqueId" TEXT NOT NULL,
    "lotChequesId" TEXT NOT NULL,
    "numeroCheque" INTEGER NOT NULL,
    "compagnieId" TEXT,
    "prestataireId" TEXT NOT NULL,
    "montantTotal" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'Émise',
    "dateEmission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LettreCheque_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LettreCheque_numero_key" ON "LettreCheque"("numero");
CREATE INDEX "LettreCheque_banqueId_idx" ON "LettreCheque"("banqueId");
CREATE INDEX "LettreCheque_prestataireId_idx" ON "LettreCheque"("prestataireId");
CREATE INDEX "LettreCheque_compagnieId_idx" ON "LettreCheque"("compagnieId");

ALTER TABLE "LettreCheque" ADD CONSTRAINT "LettreCheque_banqueId_fkey" FOREIGN KEY ("banqueId") REFERENCES "Banque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LettreCheque" ADD CONSTRAINT "LettreCheque_lotChequesId_fkey" FOREIGN KEY ("lotChequesId") REFERENCES "LotCheques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LettreCheque" ADD CONSTRAINT "LettreCheque_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LettreCheque" ADD CONSTRAINT "LettreCheque_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "BordereauReglement" ADD COLUMN "lettreChequeId" TEXT;
ALTER TABLE "BordereauReglement" ADD CONSTRAINT "BordereauReglement_lettreChequeId_fkey" FOREIGN KEY ("lettreChequeId") REFERENCES "LettreCheque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
