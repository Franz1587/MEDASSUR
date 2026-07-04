-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "initiales" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pays" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "tel" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compagnie" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "pays" TEXT NOT NULL,
    "taux" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,

    CONSTRAINT "Compagnie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "etape" TEXT NOT NULL,
    "valeurEstimee" DECIMAL(18,2) NOT NULL,
    "commercial" TEXT NOT NULL,
    "dernierContact" TEXT NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrat" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "branche" TEXT NOT NULL,
    "dateDebut" TEXT NOT NULL,
    "dateFin" TEXT NOT NULL,
    "prime" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "Contrat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devis" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branche" TEXT NOT NULL,
    "primeEstimee" DECIMAL(18,2) NOT NULL,
    "dateCreation" TEXT NOT NULL,
    "validite" TEXT NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "Devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevisOffre" (
    "id" TEXT NOT NULL,
    "devisId" TEXT NOT NULL,
    "compagnieNom" TEXT NOT NULL,
    "prime" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "DevisOffre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Renouvellement" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "joursRestants" INTEGER NOT NULL,
    "primeActuelle" DECIMAL(18,2) NOT NULL,
    "primeProposee" DECIMAL(18,2) NOT NULL,
    "sinistralite" TEXT NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "Renouvellement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avenant" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "primeAvant" DECIMAL(18,2) NOT NULL,
    "primeApres" DECIMAL(18,2) NOT NULL,
    "dateEffet" TEXT NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "Avenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resiliation" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "dateEffet" TEXT NOT NULL,
    "ristourne" DECIMAL(18,2) NOT NULL,
    "initiateur" TEXT NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "Resiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliceIard" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sousBranche" TEXT NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "capitalAssure" DECIMAL(18,2) NOT NULL,
    "prime" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "PoliceIard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratVie" (
    "id" TEXT NOT NULL,
    "assure" TEXT NOT NULL,
    "produit" TEXT NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "capitalGaranti" DECIMAL(18,2) NOT NULL,
    "primeAnnuelle" DECIMAL(18,2) NOT NULL,
    "dateEffet" TEXT NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "ContratVie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiaire" (
    "id" TEXT NOT NULL,
    "contratVieId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "lien" TEXT NOT NULL,
    "quotePart" INTEGER NOT NULL,

    CONSTRAINT "Beneficiaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flotte" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "nbVehicules" INTEGER NOT NULL,
    "primeTotal" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "Flotte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicule" (
    "id" TEXT NOT NULL,
    "flotteId" TEXT NOT NULL,
    "immatriculation" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "conducteur" TEXT NOT NULL,
    "valeurVenale" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "Vehicule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sinistre" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branche" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL,
    "priorite" TEXT NOT NULL,

    CONSTRAINT "Sinistre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssureSante" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "beneficiaires" INTEGER NOT NULL,
    "cotisation" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "AssureSante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriseEnCharge" (
    "id" TEXT NOT NULL,
    "assureId" TEXT NOT NULL,
    "prestataire" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL,
    "date" TEXT NOT NULL,

    CONSTRAINT "PriseEnCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "compagnieId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "primeEncaissee" DECIMAL(18,2) NOT NULL,
    "tauxCommission" TEXT NOT NULL,
    "montantCommission" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompteBancaire" (
    "id" TEXT NOT NULL,
    "banque" TEXT NOT NULL,
    "pays" TEXT NOT NULL,
    "devise" TEXT NOT NULL,
    "solde" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CompteBancaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FluxTresorerie" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "rapproche" BOOLEAN NOT NULL,

    CONSTRAINT "FluxTresorerie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Impaye" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "montantDu" DECIMAL(18,2) NOT NULL,
    "joursRetard" INTEGER NOT NULL,
    "niveau" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "Impaye_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "num" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL,
    "credit" DECIMAL(18,2) NOT NULL,
    "compte" TEXT NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GedDocument" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entiteLiee" TEXT NOT NULL,
    "statutOcr" TEXT NOT NULL,
    "statutSignature" TEXT NOT NULL,
    "tags" TEXT[],
    "date" TEXT NOT NULL,

    CONSTRAINT "GedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Flotte_contratId_key" ON "Flotte"("contratId");

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevisOffre" ADD CONSTRAINT "DevisOffre_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renouvellement" ADD CONSTRAINT "Renouvellement_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resiliation" ADD CONSTRAINT "Resiliation_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliceIard" ADD CONSTRAINT "PoliceIard_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliceIard" ADD CONSTRAINT "PoliceIard_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratVie" ADD CONSTRAINT "ContratVie_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiaire" ADD CONSTRAINT "Beneficiaire_contratVieId_fkey" FOREIGN KEY ("contratVieId") REFERENCES "ContratVie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flotte" ADD CONSTRAINT "Flotte_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flotte" ADD CONSTRAINT "Flotte_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flotte" ADD CONSTRAINT "Flotte_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_flotteId_fkey" FOREIGN KEY ("flotteId") REFERENCES "Flotte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sinistre" ADD CONSTRAINT "Sinistre_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssureSante" ADD CONSTRAINT "AssureSante_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriseEnCharge" ADD CONSTRAINT "PriseEnCharge_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impaye" ADD CONSTRAINT "Impaye_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impaye" ADD CONSTRAINT "Impaye_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
