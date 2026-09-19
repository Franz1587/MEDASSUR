-- AlterTable
ALTER TABLE "FactureProductionLigne" ADD COLUMN "contratId" TEXT;
ALTER TABLE "FactureProductionLigne" ADD COLUMN "avenantId" TEXT;

-- AlterTable
ALTER TABLE "Compagnie" ADD COLUMN "notePaiementDefaut" TEXT;

-- AddForeignKey
ALTER TABLE "FactureProductionLigne" ADD CONSTRAINT "FactureProductionLigne_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureProductionLigne" ADD CONSTRAINT "FactureProductionLigne_avenantId_fkey" FOREIGN KEY ("avenantId") REFERENCES "Avenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
