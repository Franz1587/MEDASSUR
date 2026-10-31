-- AlterTable
ALTER TABLE "Cotation" ADD COLUMN "contenuOffre" JSONB,
ADD COLUMN "documentSourceId" TEXT;

-- AlterTable
ALTER TABLE "AppelOffres" ADD COLUMN "parametresOffre" JSONB;
