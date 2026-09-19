-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Prospect" ADD COLUMN "contactNom" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "contactFonction" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "contactTelephone" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "typeContrat" TEXT;
ALTER TABLE "Prospect" ADD COLUMN "clientId" TEXT;

CREATE UNIQUE INDEX "Prospect_clientId_key" ON "Prospect"("clientId");

ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ProspectHistorique" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteurId" TEXT,
    "type" TEXT NOT NULL,
    "etapeAvant" TEXT,
    "etapeApres" TEXT,
    "description" TEXT NOT NULL,

    CONSTRAINT "ProspectHistorique_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProspectHistorique_prospectId_idx" ON "ProspectHistorique"("prospectId");

ALTER TABLE "ProspectHistorique" ADD CONSTRAINT "ProspectHistorique_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectHistorique" ADD CONSTRAINT "ProspectHistorique_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
