-- Chèque bancaire extrait par ARIANA (2026-11)
-- numeroChequeExtrait : numéro de chèque lu sur le document scanné
-- nomBanqueExtrait    : nom de la banque lu sur le document
ALTER TABLE "GedDocument"
  ADD COLUMN "numeroChequeExtrait" INTEGER,
  ADD COLUMN "nomBanqueExtrait"    TEXT;
