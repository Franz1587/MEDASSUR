-- AlterTable
ALTER TABLE "Contrat" ADD COLUMN "agenceId" TEXT;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_agenceId_fkey" FOREIGN KEY ("agenceId") REFERENCES "Agence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
