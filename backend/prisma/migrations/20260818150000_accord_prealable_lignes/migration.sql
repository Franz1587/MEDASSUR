-- Lignes d'une demande de prise en charge (2026-08) -- une prise en charge
-- peut couvrir plusieurs actes liés (bloc chirurgical KC/KA/K Loc, ou
-- simplement plusieurs actes distincts), chacun avec son propre plafond de
-- référence et ses propres frais réels (voir demande utilisateur).
CREATE TABLE "AccordPrealableLigne" (
  "id" TEXT NOT NULL,
  "accordPrealableId" TEXT NOT NULL,
  "acteMedicalId" TEXT,
  "lettreCleCode" TEXT,
  "coefficient" DECIMAL(10,2),
  "description" TEXT NOT NULL,
  "plafondReference" DECIMAL(18,2) NOT NULL,
  "montantDevis" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccordPrealableLigne_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AccordPrealableLigne" ADD CONSTRAINT "AccordPrealableLigne_accordPrealableId_fkey"
  FOREIGN KEY ("accordPrealableId") REFERENCES "AccordPrealable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccordPrealableLigne" ADD CONSTRAINT "AccordPrealableLigne_acteMedicalId_fkey"
  FOREIGN KEY ("acteMedicalId") REFERENCES "ActeMedical"("id") ON DELETE SET NULL ON UPDATE CASCADE;
