-- Compteurs atomiques (jamais de doublon même sous accès concurrents,
-- jamais de remise à zéro — voir DocumentsService.obtenirOuCreerDecompte
-- et ReglementPrestataireService.genererBordereau).
CREATE SEQUENCE "decompte_numero_seq" START 1;
CREATE SEQUENCE "reglement_numero_seq" START 1;

-- CreateTable
CREATE TABLE "Decompte" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "assureId" TEXT NOT NULL,
    "dateEmission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decompte_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Decompte_numero_key" ON "Decompte"("numero");
CREATE UNIQUE INDEX "Decompte_factureId_assureId_key" ON "Decompte"("factureId", "assureId");

ALTER TABLE "Decompte" ADD CONSTRAINT "Decompte_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Decompte" ADD CONSTRAINT "Decompte_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable — numero nullable le temps de rétro-numéroter les bordereaux existants
ALTER TABLE "BordereauReglement" ADD COLUMN "numero" TEXT;

UPDATE "BordereauReglement"
SET "numero" = 'REG-' || lpad(nextval('reglement_numero_seq')::text, 6, '0')
WHERE "numero" IS NULL;

ALTER TABLE "BordereauReglement" ALTER COLUMN "numero" SET NOT NULL;
CREATE UNIQUE INDEX "BordereauReglement_numero_key" ON "BordereauReglement"("numero");
