-- Auto-Gestion : un Client peut être lié à au plus une Compagnie
-- (sa "compagnie virtuelle" auto-gérée). Pas de ON DELETE CASCADE
-- volontairement : supprimer le client ne doit pas supprimer en silence
-- son profil auto-gestion et casser les contrats qui le référencent.
ALTER TABLE "Compagnie" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Compagnie" ADD CONSTRAINT "Compagnie_clientId_key" UNIQUE ("clientId");
ALTER TABLE "Compagnie" ADD CONSTRAINT "Compagnie_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
