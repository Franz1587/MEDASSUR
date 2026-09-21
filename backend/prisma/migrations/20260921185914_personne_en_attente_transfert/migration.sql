-- CreateTable
CREATE TABLE "PersonneEnAttenteTransfert" (
    "id" TEXT NOT NULL,
    "societeId" TEXT,
    "matricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "contratSourceId" TEXT NOT NULL,
    "contratCibleId" TEXT NOT NULL,
    "statutImport" TEXT,
    "motif" TEXT NOT NULL,
    "donneesLigne" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonneEnAttenteTransfert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonneEnAttenteTransfert_matricule_idx" ON "PersonneEnAttenteTransfert"("matricule");

-- CreateIndex
CREATE INDEX "PersonneEnAttenteTransfert_societeId_idx" ON "PersonneEnAttenteTransfert"("societeId");

-- AddForeignKey
ALTER TABLE "PersonneEnAttenteTransfert" ADD CONSTRAINT "PersonneEnAttenteTransfert_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
