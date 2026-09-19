-- Type de société (Courtier | Mutuelle | Compagnie) + compagnie interne
-- auto-provisionnée pour les sociétés Mutuelle/Compagnie (2026-09).
ALTER TABLE "SocieteAssurance" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'Courtier';
ALTER TABLE "SocieteAssurance" ADD COLUMN "compagnieInterneId" TEXT;

CREATE UNIQUE INDEX "SocieteAssurance_compagnieInterneId_key" ON "SocieteAssurance"("compagnieInterneId");

ALTER TABLE "SocieteAssurance" ADD CONSTRAINT "SocieteAssurance_compagnieInterneId_fkey"
  FOREIGN KEY ("compagnieInterneId") REFERENCES "Compagnie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
