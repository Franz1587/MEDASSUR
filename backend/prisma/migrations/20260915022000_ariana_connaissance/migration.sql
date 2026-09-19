-- Base de connaissance consultable par l'agent IA Ariana (2026-09).
CREATE TABLE "ArianaConnaissance" (
    "id" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "societeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArianaConnaissance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArianaConnaissance_categorie_idx" ON "ArianaConnaissance"("categorie");
CREATE INDEX "ArianaConnaissance_societeId_idx" ON "ArianaConnaissance"("societeId");
