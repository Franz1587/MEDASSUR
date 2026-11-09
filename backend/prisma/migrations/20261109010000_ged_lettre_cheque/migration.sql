-- Lien règlement comptable sur GedDocument (2026-11)
-- ARIANA remonte la LettreCheque (chèque bancaire) associée au
-- BordereauReglement trouvé lors du rapprochement automatique.
ALTER TABLE "GedDocument" ADD COLUMN "lettreChequeId" TEXT;

ALTER TABLE "GedDocument"
  ADD CONSTRAINT "GedDocument_lettreChequeId_fkey"
  FOREIGN KEY ("lettreChequeId")
  REFERENCES "LettreCheque"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "GedDocument_lettreChequeId_idx" ON "GedDocument"("lettreChequeId");
