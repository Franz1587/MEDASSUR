-- CreateTable — numéros de facture prestataire additionnels, une
-- déclaration (Facture) pouvant en regrouper plusieurs (voir schema.prisma
-- Facture.numerosSupplementaires).
CREATE TABLE "NumeroFacture" (
    "id" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,

    CONSTRAINT "NumeroFacture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NumeroFacture_factureId_numero_key" ON "NumeroFacture"("factureId", "numero");
CREATE INDEX "NumeroFacture_numero_idx" ON "NumeroFacture"("numero");

ALTER TABLE "NumeroFacture" ADD CONSTRAINT "NumeroFacture_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
