-- CreateTable
CREATE TABLE "AvenantAssure" (
    "id" TEXT NOT NULL,
    "avenantId" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "assureId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "matricule" TEXT,
    "typeAssure" TEXT,
    "action" TEXT NOT NULL,
    "dateEffet" TEXT NOT NULL,

    CONSTRAINT "AvenantAssure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvenantAssure_contratId_dateEffet_idx" ON "AvenantAssure"("contratId", "dateEffet");

-- CreateIndex
CREATE INDEX "AvenantAssure_assureId_idx" ON "AvenantAssure"("assureId");

-- AddForeignKey
ALTER TABLE "AvenantAssure" ADD CONSTRAINT "AvenantAssure_avenantId_fkey" FOREIGN KEY ("avenantId") REFERENCES "Avenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
