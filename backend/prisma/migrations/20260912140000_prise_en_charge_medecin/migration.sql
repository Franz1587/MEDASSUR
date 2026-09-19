-- Médecin assigné par l'accueil à une consultation (file d'attente stricte).
ALTER TABLE "PriseEnCharge" ADD COLUMN "medecinId" TEXT;
CREATE INDEX "PriseEnCharge_medecinId_idx" ON "PriseEnCharge"("medecinId");
ALTER TABLE "PriseEnCharge" ADD CONSTRAINT "PriseEnCharge_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
