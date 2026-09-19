-- CreateTable
CREATE TABLE "EncaissementPrime" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "dateEncaissement" TEXT NOT NULL,
    "modePaiement" TEXT,
    "referencePaiement" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncaissementPrime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EncaissementPrime_contratId_idx" ON "EncaissementPrime"("contratId");

-- AddForeignKey
ALTER TABLE "EncaissementPrime" ADD CONSTRAINT "EncaissementPrime_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
