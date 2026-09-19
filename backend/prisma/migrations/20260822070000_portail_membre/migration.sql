-- DropForeignKey
ALTER TABLE "CompteAssureMobile" DROP CONSTRAINT "CompteAssureMobile_assureId_fkey";

-- DropTable
DROP TABLE "CompteAssureMobile";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "assureSanteId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_assureSanteId_key" ON "User"("assureSanteId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assureSanteId_fkey" FOREIGN KEY ("assureSanteId") REFERENCES "AssureSante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "PriseEnCharge" ADD COLUMN "prescriptionFichier" TEXT,
ADD COLUMN "factureFichier" TEXT,
ADD COLUMN "quittanceFichier" TEXT,
ADD COLUMN "autreFichier" TEXT;
