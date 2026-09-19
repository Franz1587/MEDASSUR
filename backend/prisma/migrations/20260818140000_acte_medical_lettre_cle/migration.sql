-- Codification à la lettre clé paramétrée sur l'acte du catalogue lui-même
-- (2026-08) -- voir demande utilisateur : "ce sont des actes qui sont
-- paramétrés... le système remonte son coefficient".
ALTER TABLE "ActeMedical" ADD COLUMN "lettreCleCode" TEXT;
ALTER TABLE "ActeMedical" ADD COLUMN "coefficient" DECIMAL(10,2);

ALTER TABLE "ActeMedical" ADD CONSTRAINT "ActeMedical_lettreCleCode_fkey"
  FOREIGN KEY ("lettreCleCode") REFERENCES "LettreCle"("code") ON DELETE SET NULL ON UPDATE CASCADE;
