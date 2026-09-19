-- Alias de nom de prestataire — reprise d'antériorité.
CREATE TABLE "PrestataireAlias" (
    "id" TEXT NOT NULL,
    "nomOrigine" TEXT NOT NULL,
    "prestataireId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrestataireAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrestataireAlias_nomOrigine_key" ON "PrestataireAlias"("nomOrigine");

ALTER TABLE "PrestataireAlias" ADD CONSTRAINT "PrestataireAlias_prestataireId_fkey"
    FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
