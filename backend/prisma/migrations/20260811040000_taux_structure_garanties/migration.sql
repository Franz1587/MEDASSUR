ALTER TABLE "CotationGarantieLigne" ADD COLUMN "tauxStructurePrivee" TEXT;
ALTER TABLE "CotationGarantieLigne" ADD COLUMN "tauxStructurePublique" TEXT;
ALTER TABLE "GarantieCatalogue" ADD COLUMN "tauxStructurePriveeDefaut" TEXT;
ALTER TABLE "GarantieCatalogue" ADD COLUMN "tauxStructurePubliqueDefaut" TEXT;
