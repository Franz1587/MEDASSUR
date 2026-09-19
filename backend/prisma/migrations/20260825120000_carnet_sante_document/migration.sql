CREATE TABLE "CarnetSanteDocument" (
    "id" TEXT NOT NULL,
    "assureId" TEXT NOT NULL,
    "rubrique" TEXT NOT NULL,
    "fichier" TEXT NOT NULL,
    "libelle" TEXT,
    "dateAjout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarnetSanteDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CarnetSanteDocument_assureId_idx" ON "CarnetSanteDocument"("assureId");

ALTER TABLE "CarnetSanteDocument" ADD CONSTRAINT "CarnetSanteDocument_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
