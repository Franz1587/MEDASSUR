ALTER TABLE "EncaissementPrime" ADD COLUMN "banqueId" TEXT;

CREATE INDEX "EncaissementPrime_banqueId_idx" ON "EncaissementPrime"("banqueId");

ALTER TABLE "EncaissementPrime" ADD CONSTRAINT "EncaissementPrime_banqueId_fkey"
  FOREIGN KEY ("banqueId") REFERENCES "Banque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
