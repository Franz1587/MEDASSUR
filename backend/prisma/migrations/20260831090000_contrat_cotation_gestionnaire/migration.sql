ALTER TABLE "Contrat" ADD COLUMN "gestionnaireId" TEXT;
ALTER TABLE "Cotation" ADD COLUMN "gestionnaireId" TEXT;

ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cotation" ADD CONSTRAINT "Cotation_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
