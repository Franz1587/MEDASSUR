-- CreateTable
CREATE TABLE "NiveauRelance" (
    "id" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "joursAvantEcheance" INTEGER NOT NULL,
    "objet" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NiveauRelance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelanceEnvoyee" (
    "id" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "niveauRelanceId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT NOT NULL,
    "communicationId" TEXT,

    CONSTRAINT "RelanceEnvoyee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NiveauRelance_societeId_idx" ON "NiveauRelance"("societeId");

-- CreateIndex
CREATE UNIQUE INDEX "NiveauRelance_societeId_ordre_key" ON "NiveauRelance"("societeId", "ordre");

-- CreateIndex
CREATE INDEX "RelanceEnvoyee_societeId_idx" ON "RelanceEnvoyee"("societeId");

-- CreateIndex
CREATE UNIQUE INDEX "RelanceEnvoyee_contratId_niveauRelanceId_key" ON "RelanceEnvoyee"("contratId", "niveauRelanceId");

-- AddForeignKey
ALTER TABLE "NiveauRelance" ADD CONSTRAINT "NiveauRelance_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelanceEnvoyee" ADD CONSTRAINT "RelanceEnvoyee_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelanceEnvoyee" ADD CONSTRAINT "RelanceEnvoyee_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelanceEnvoyee" ADD CONSTRAINT "RelanceEnvoyee_niveauRelanceId_fkey" FOREIGN KEY ("niveauRelanceId") REFERENCES "NiveauRelance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
