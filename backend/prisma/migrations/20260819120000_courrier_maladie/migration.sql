-- CreateTable
CREATE TABLE "CourrierType" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "corpsModele" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CourrierType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courrier" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "typeId" TEXT,
    "objet" TEXT NOT NULL,
    "destinataireNom" TEXT NOT NULL,
    "destinataireAdresse" TEXT,
    "clientId" TEXT,
    "prestataireId" TEXT,
    "assureId" TEXT,
    "corps" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "dateCreation" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'Généré',

    CONSTRAINT "Courrier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Courrier_reference_key" ON "Courrier"("reference");

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CourrierType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courrier" ADD CONSTRAINT "Courrier_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
