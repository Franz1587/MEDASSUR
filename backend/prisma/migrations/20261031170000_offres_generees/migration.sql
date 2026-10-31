-- CreateTable
CREATE TABLE "OffreGeneree" (
    "id" TEXT NOT NULL,
    "societeId" TEXT,
    "appelOffresId" TEXT,
    "clientNom" TEXT NOT NULL,
    "origine" TEXT NOT NULL,
    "fichier" TEXT NOT NULL,
    "tailleOctets" INTEGER NOT NULL,
    "nbPages" INTEGER NOT NULL,
    "cotationIds" TEXT[],
    "creeParId" TEXT,
    "creeParNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OffreGeneree_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OffreGeneree_societeId_idx" ON "OffreGeneree"("societeId");

-- CreateIndex
CREATE INDEX "OffreGeneree_appelOffresId_idx" ON "OffreGeneree"("appelOffresId");

-- AddForeignKey
ALTER TABLE "OffreGeneree" ADD CONSTRAINT "OffreGeneree_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffreGeneree" ADD CONSTRAINT "OffreGeneree_appelOffresId_fkey" FOREIGN KEY ("appelOffresId") REFERENCES "AppelOffres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
