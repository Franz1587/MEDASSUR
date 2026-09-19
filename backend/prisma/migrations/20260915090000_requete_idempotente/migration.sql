-- Fondation idempotence pour la synchronisation hors-ligne (2026-09).
CREATE TABLE "RequeteIdempotente" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "reponse" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequeteIdempotente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RequeteIdempotente_cle_key" ON "RequeteIdempotente"("cle");
CREATE INDEX "RequeteIdempotente_createdAt_idx" ON "RequeteIdempotente"("createdAt");
