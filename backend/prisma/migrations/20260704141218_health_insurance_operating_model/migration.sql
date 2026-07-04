-- AlterTable
ALTER TABLE "AssureSante" ADD COLUMN     "dateAffiliation" TEXT,
ADD COLUMN     "dateNaissance" TEXT,
ADD COLUMN     "dateRadiation" TEXT,
ADD COLUMN     "motifRadiation" TEXT,
ADD COLUMN     "numeroAssure" TEXT,
ADD COLUMN     "qrCode" TEXT,
ADD COLUMN     "statutCarte" TEXT,
ADD COLUMN     "statutMatrimonial" TEXT;

-- AlterTable
ALTER TABLE "PriseEnCharge" ADD COLUMN     "accordPrealableId" TEXT,
ADD COLUMN     "baseRemboursement" DECIMAL(18,2),
ADD COLUMN     "factureRef" TEXT,
ADD COLUMN     "franchise" DECIMAL(18,2),
ADD COLUMN     "modePaiement" TEXT,
ADD COLUMN     "motifRejet" TEXT,
ADD COLUMN     "ordrePaiement" TEXT,
ADD COLUMN     "plafondApplique" DECIMAL(18,2),
ADD COLUMN     "prescriptionRef" TEXT,
ADD COLUMN     "prestataireId" TEXT,
ADD COLUMN     "resteACharge" DECIMAL(18,2),
ADD COLUMN     "scoreFraude" DECIMAL(5,2),
ADD COLUMN     "statutControleMedical" TEXT,
ADD COLUMN     "tauxRemboursement" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "budget" DECIMAL(18,2),
ADD COLUMN     "effectifEstime" INTEGER,
ADD COLUMN     "historiqueAssurance" TEXT,
ADD COLUMN     "scoring" TEXT,
ADD COLUMN     "zoneGeographique" TEXT;

-- CreateTable
CREATE TABLE "AppelOffres" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "clientNom" TEXT NOT NULL,
    "cahierCharges" TEXT NOT NULL,
    "garantiesDemandees" TEXT NOT NULL,
    "historiqueSinistres" TEXT,
    "projectionSP" DECIMAL(5,2) NOT NULL,
    "estimationPepm" DECIMAL(18,2) NOT NULL,
    "estimationFondsRoulement" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL,
    "dateCreation" TEXT NOT NULL,

    CONSTRAINT "AppelOffres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropositionCommerciale" (
    "id" TEXT NOT NULL,
    "appelOffresId" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "primeProposee" DECIMAL(18,2) NOT NULL,
    "descriptionGaranties" TEXT NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "PropositionCommerciale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotation" (
    "id" TEXT NOT NULL,
    "clientNom" TEXT NOT NULL,
    "agePopulationMoyen" DECIMAL(5,2) NOT NULL,
    "sexeRatio" TEXT NOT NULL,
    "historiqueSinistres" DECIMAL(18,2) NOT NULL,
    "niveauGaranties" TEXT NOT NULL,
    "territorialite" TEXT NOT NULL,
    "stopLoss" DECIMAL(18,2) NOT NULL,
    "primePure" DECIMAL(18,2) NOT NULL,
    "chargements" DECIMAL(18,2) NOT NULL,
    "marge" DECIMAL(18,2) NOT NULL,
    "commission" DECIMAL(18,2) NOT NULL,
    "pepm" DECIMAL(18,2) NOT NULL,
    "tarifFinal" DECIMAL(18,2) NOT NULL,
    "dateCreation" TEXT NOT NULL,

    CONSTRAINT "Cotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AyantDroit" (
    "id" TEXT NOT NULL,
    "assureId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "lienParente" TEXT NOT NULL,
    "dateNaissance" TEXT NOT NULL,
    "statut" TEXT NOT NULL,

    CONSTRAINT "AyantDroit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prestataire" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pays" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "statutConvention" TEXT NOT NULL,
    "dateConventionnement" TEXT,
    "delaiPaiementMoyen" INTEGER,
    "scoreQualite" DECIMAL(5,2),
    "motifSuspension" TEXT,

    CONSTRAINT "Prestataire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrilleTarifaire" (
    "id" TEXT NOT NULL,
    "prestataireId" TEXT NOT NULL,
    "acte" TEXT NOT NULL,
    "plafond" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "GrilleTarifaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccordPrealable" (
    "id" TEXT NOT NULL,
    "assureId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dateDemande" TEXT NOT NULL,
    "statutAnalyseMedicale" TEXT NOT NULL,
    "statutValidationFinanciere" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "montantAutorise" DECIMAL(18,2),
    "dateDecision" TEXT,

    CONSTRAINT "AccordPrealable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FondsDeRoulement" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "montantInitial" DECIMAL(18,2) NOT NULL,
    "montantConsomme" DECIMAL(18,2) NOT NULL,
    "seuilAlerte" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL,
    "dateAlimentation" TEXT NOT NULL,

    CONSTRAINT "FondsDeRoulement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HonorairesGestion" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "montantSinistres" DECIMAL(18,2) NOT NULL,
    "tauxHonoraires" DECIMAL(5,2) NOT NULL,
    "montantHonoraires" DECIMAL(18,2) NOT NULL,
    "plafond" DECIMAL(18,2),
    "statut" TEXT NOT NULL,

    CONSTRAINT "HonorairesGestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringFraude" (
    "id" TEXT NOT NULL,
    "cible" TEXT NOT NULL,
    "cibleId" TEXT NOT NULL,
    "cibleNom" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "motifs" TEXT NOT NULL,
    "dateEvaluation" TEXT NOT NULL,

    CONSTRAINT "ScoringFraude_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "utilisateur" TEXT NOT NULL,
    "dateAction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "destinataireType" TEXT NOT NULL,
    "destinataireId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "dateEnvoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssureSante_numeroAssure_key" ON "AssureSante"("numeroAssure");

-- AddForeignKey
ALTER TABLE "AppelOffres" ADD CONSTRAINT "AppelOffres_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropositionCommerciale" ADD CONSTRAINT "PropositionCommerciale_appelOffresId_fkey" FOREIGN KEY ("appelOffresId") REFERENCES "AppelOffres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AyantDroit" ADD CONSTRAINT "AyantDroit_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrilleTarifaire" ADD CONSTRAINT "GrilleTarifaire_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccordPrealable" ADD CONSTRAINT "AccordPrealable_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriseEnCharge" ADD CONSTRAINT "PriseEnCharge_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriseEnCharge" ADD CONSTRAINT "PriseEnCharge_accordPrealableId_fkey" FOREIGN KEY ("accordPrealableId") REFERENCES "AccordPrealable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FondsDeRoulement" ADD CONSTRAINT "FondsDeRoulement_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HonorairesGestion" ADD CONSTRAINT "HonorairesGestion_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

