CREATE TABLE "IdentiteAssuree" (
  "id" TEXT NOT NULL,
  "matricule" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "prenom" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentiteAssuree_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdentiteAssuree_matricule_key" ON "IdentiteAssuree"("matricule");
CREATE INDEX "IdentiteAssuree_nom_idx" ON "IdentiteAssuree"("nom");

INSERT INTO "IdentiteAssuree" ("id", "matricule", "nom", "prenom")
SELECT 'ID-' || md5(min("id") || ':' || "matricule"), "matricule", min("nom"), min("prenom")
FROM "AssureSante"
WHERE trim("matricule") <> ''
GROUP BY "matricule";

ALTER TABLE "AssureSante" ADD COLUMN "identiteId" TEXT;
UPDATE "AssureSante" a
SET "identiteId" = i."id"
FROM "IdentiteAssuree" i
WHERE i."matricule" = a."matricule";

CREATE INDEX "AssureSante_identiteId_idx" ON "AssureSante"("identiteId");
ALTER TABLE "AssureSante" ADD CONSTRAINT "AssureSante_identiteId_fkey"
  FOREIGN KEY ("identiteId") REFERENCES "IdentiteAssuree"("id") ON DELETE SET NULL ON UPDATE CASCADE;