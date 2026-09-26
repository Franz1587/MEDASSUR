-- Déclinaison d'agence d'une compagnie (ex. NSIA ASSURANCES POG) + création automatique paramétrable par agence
ALTER TABLE "Compagnie" ADD COLUMN "compagnieMereId" TEXT;
ALTER TABLE "Compagnie" ADD COLUMN "agenceId" TEXT;
ALTER TABLE "Agence" ADD COLUMN "creerDeclinaisonsAuto" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Compagnie" ADD CONSTRAINT "Compagnie_compagnieMereId_fkey" FOREIGN KEY ("compagnieMereId") REFERENCES "Compagnie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Compagnie" ADD CONSTRAINT "Compagnie_agenceId_fkey" FOREIGN KEY ("agenceId") REFERENCES "Agence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Compagnie_compagnieMereId_idx" ON "Compagnie"("compagnieMereId");
