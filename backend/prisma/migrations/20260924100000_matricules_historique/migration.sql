CREATE TABLE "MatriculeAssuree" (
  "id" TEXT NOT NULL,
  "matricule" TEXT NOT NULL,
  "identiteId" TEXT NOT NULL,
  "statut" TEXT NOT NULL DEFAULT 'Ancien',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatriculeAssuree_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MatriculeAssuree_identiteId_fkey" FOREIGN KEY ("identiteId") REFERENCES "IdentiteAssuree"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MatriculeAssuree_matricule_key" ON "MatriculeAssuree"("matricule");
CREATE INDEX "MatriculeAssuree_identiteId_idx" ON "MatriculeAssuree"("identiteId");