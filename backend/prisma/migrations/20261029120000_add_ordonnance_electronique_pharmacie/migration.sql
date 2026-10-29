-- Ordonnance électronique pharmacie (2026-10)
-- medicamentsLus : JSON [{nom,dosage,quantite,duree}] extrait par Ariana (vision Claude)
-- codeAccesPharmacie : code court unique (ex: ORD-2026-AB12CD) communiqué à la pharmacie
ALTER TABLE "AccordPrealable" ADD COLUMN "medicamentsLus" TEXT;
ALTER TABLE "AccordPrealable" ADD COLUMN "codeAccesPharmacie" TEXT;
CREATE UNIQUE INDEX "AccordPrealable_codeAccesPharmacie_key" ON "AccordPrealable"("codeAccesPharmacie");
