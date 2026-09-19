-- AlterTable
ALTER TABLE "Contrat" ADD COLUMN "plafondChambreJour" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "destinataireType" TEXT NOT NULL,
    "destinataireId" TEXT,
    "destinataireNom" TEXT NOT NULL,
    "destinataireContact" TEXT NOT NULL,
    "objet" TEXT,
    "contenu" TEXT NOT NULL,
    "pieceJointe" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'Simulé',
    "declencheur" TEXT NOT NULL DEFAULT 'Manuel',
    "retour" TEXT,
    "retourDate" TIMESTAMP(3),
    "auteurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Communication_destinataireType_destinataireId_idx" ON "Communication"("destinataireType", "destinataireId");
CREATE INDEX "Communication_canal_idx" ON "Communication"("canal");

ALTER TABLE "Communication" ADD CONSTRAINT "Communication_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
