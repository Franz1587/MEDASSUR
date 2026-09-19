-- AlterTable
ALTER TABLE "Devis" ADD COLUMN     "gestionnaireId" TEXT;

-- AlterTable
ALTER TABLE "PriseEnCharge" ADD COLUMN     "gestionnaireId" TEXT;

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "gestionnaireId" TEXT;

-- AlterTable
ALTER TABLE "Sinistre" ADD COLUMN     "gestionnaireId" TEXT;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sinistre" ADD CONSTRAINT "Sinistre_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriseEnCharge" ADD CONSTRAINT "PriseEnCharge_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
