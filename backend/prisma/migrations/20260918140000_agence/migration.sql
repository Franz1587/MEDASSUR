-- Agence (2026-09) — voir demande utilisateur : "il faut rendre possible le
-- fait que l'application permette de lier un agent de saisie à une agence
-- du client (compagnie, courtier, mutuelle) afin que ce soit cette agence
-- qui remonte sur le décompte."
ALTER TABLE "User" ADD COLUMN     "agenceId" TEXT;

CREATE TABLE "Agence" (
    "id" TEXT NOT NULL,
    "societeId" TEXT,
    "nom" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Agence_societeId_idx" ON "Agence"("societeId");
CREATE INDEX "User_agenceId_idx" ON "User"("agenceId");

ALTER TABLE "User" ADD CONSTRAINT "User_agenceId_fkey" FOREIGN KEY ("agenceId") REFERENCES "Agence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Agence" ADD CONSTRAINT "Agence_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
