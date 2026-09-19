-- AlterTable
ALTER TABLE "Prestataire" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "etablissementId" TEXT;

-- AddForeignKey
ALTER TABLE "Prestataire" ADD CONSTRAINT "Prestataire_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "Prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Prestataire_etablissementId_idx" ON "Prestataire"("etablissementId");
