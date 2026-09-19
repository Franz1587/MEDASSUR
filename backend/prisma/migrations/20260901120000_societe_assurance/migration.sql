-- Sociétés d'assurance (Super Admin, Phase 1 du chantier multi-tenant).
CREATE TABLE "SocieteAssurance" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "ville" TEXT,
    "pays" TEXT NOT NULL DEFAULT 'Gabon',
    "statut" TEXT NOT NULL DEFAULT 'Actif',
    "motifSuspension" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocieteAssurance_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "societeId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_societeId_fkey"
    FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_societeId_idx" ON "User"("societeId");

-- Société bootstrap — reprend l'identité de l'unique tenant déjà en place
-- pour que rien ne casse avant la Phase 2 (isolation réelle des données
-- métier). Tous les utilisateurs EXISTANTS (aucun n'est encore super_admin
-- à cette étape — ce compte est provisionné séparément par le seed) lui
-- sont rattachés.
INSERT INTO "SocieteAssurance" ("id", "nom", "email", "telephone", "ville", "pays", "statut", "createdAt")
VALUES ('societe-bootstrap', 'MedAssur', 'contact@medassur.ga', '+241 01 00 00 00', 'Libreville', 'Gabon', 'Actif', CURRENT_TIMESTAMP);

UPDATE "User" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;
