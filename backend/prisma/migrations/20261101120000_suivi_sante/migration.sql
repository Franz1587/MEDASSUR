-- DropForeignKey
ALTER TABLE "Prescription" DROP CONSTRAINT "Prescription_medecinId_fkey";

-- DropForeignKey
ALTER TABLE "Prescription" DROP CONSTRAINT "Prescription_priseEnChargeId_fkey";

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "assureId" TEXT,
ADD COLUMN     "carnetDocumentId" TEXT,
ADD COLUMN     "dateOrdonnance" TEXT,
ADD COLUMN     "numeroOrdonnance" TEXT,
ADD COLUMN     "origine" TEXT NOT NULL DEFAULT 'Consultation',
ADD COLUMN     "prescripteurNom" TEXT,
ADD COLUMN     "structureNom" TEXT,
ALTER COLUMN "priseEnChargeId" DROP NOT NULL,
ALTER COLUMN "medecinId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RendezVous" (
    "id" TEXT NOT NULL,
    "societeId" TEXT,
    "assureId" TEXT NOT NULL,
    "medecinId" TEXT,
    "prestataireId" TEXT,
    "type" TEXT NOT NULL,
    "motif" TEXT,
    "dateHeure" TIMESTAMP(3) NOT NULL,
    "dureeMinutes" INTEGER NOT NULL DEFAULT 30,
    "statut" TEXT NOT NULL DEFAULT 'Demandé',
    "reponse" TEXT,
    "demandeParUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RendezVous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccesDossierMedical" (
    "id" TEXT NOT NULL,
    "societeId" TEXT,
    "assureId" TEXT NOT NULL,
    "medecinId" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ouvertLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fermeLe" TIMESTAMP(3),

    CONSTRAINT "AccesDossierMedical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MesureSante" (
    "id" TEXT NOT NULL,
    "societeId" TEXT,
    "assureId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "unite" TEXT,
    "dateMesure" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "medecinId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MesureSante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RendezVous_societeId_idx" ON "RendezVous"("societeId");

-- CreateIndex
CREATE INDEX "RendezVous_assureId_idx" ON "RendezVous"("assureId");

-- CreateIndex
CREATE INDEX "RendezVous_medecinId_idx" ON "RendezVous"("medecinId");

-- CreateIndex
CREATE INDEX "RendezVous_prestataireId_idx" ON "RendezVous"("prestataireId");

-- CreateIndex
CREATE INDEX "AccesDossierMedical_societeId_idx" ON "AccesDossierMedical"("societeId");

-- CreateIndex
CREATE INDEX "AccesDossierMedical_medecinId_idx" ON "AccesDossierMedical"("medecinId");

-- CreateIndex
CREATE UNIQUE INDEX "AccesDossierMedical_assureId_medecinId_key" ON "AccesDossierMedical"("assureId", "medecinId");

-- CreateIndex
CREATE INDEX "MesureSante_societeId_idx" ON "MesureSante"("societeId");

-- CreateIndex
CREATE INDEX "MesureSante_assureId_idx" ON "MesureSante"("assureId");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_numeroOrdonnance_key" ON "Prescription"("numeroOrdonnance");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_priseEnChargeId_fkey" FOREIGN KEY ("priseEnChargeId") REFERENCES "PriseEnCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccesDossierMedical" ADD CONSTRAINT "AccesDossierMedical_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccesDossierMedical" ADD CONSTRAINT "AccesDossierMedical_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MesureSante" ADD CONSTRAINT "MesureSante_assureId_fkey" FOREIGN KEY ("assureId") REFERENCES "AssureSante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Nouveaux écrans (rendez-vous, suivi de santé, accès au dossier) ajoutés
-- une seule fois aux comptes existants : uniquement des AJOUTS, jamais un
-- retrait. Les comptes délégués à un ayant droit (assureSanteId d'un
-- membre de famille) ne sont pas touchés : l'assuré principal choisit
-- lui-même ce qu'il leur accorde.
UPDATE "RoleModuleTemplate" SET modules = modules || ARRAY(SELECT unnest(ARRAY['membreRendezVous','membreSuiviSante','membreAccesDossier']) EXCEPT SELECT unnest(modules)) WHERE "roleId" = 'assure_principal';
UPDATE "RoleModuleTemplate" SET modules = modules || ARRAY(SELECT unnest(ARRAY['medecinRendezVous']) EXCEPT SELECT unnest(modules)) WHERE "roleId" = 'medecin_prescripteur';
UPDATE "RoleModuleTemplate" SET modules = modules || ARRAY(SELECT unnest(ARRAY['prestataireRendezVous']) EXCEPT SELECT unnest(modules)) WHERE "roleId" = 'prestataire_sante';
UPDATE "User" SET modules = modules || ARRAY(SELECT unnest(ARRAY['membreRendezVous','membreSuiviSante','membreAccesDossier']) EXCEPT SELECT unnest(modules))
  WHERE "roleId" = 'assure_principal' AND "assureSanteId" IN (SELECT id FROM "AssureSante" WHERE "familleId" IS NULL);
UPDATE "User" SET modules = modules || ARRAY(SELECT unnest(ARRAY['medecinRendezVous']) EXCEPT SELECT unnest(modules)) WHERE "roleId" = 'medecin_prescripteur';
UPDATE "User" SET modules = modules || ARRAY(SELECT unnest(ARRAY['prestataireRendezVous']) EXCEPT SELECT unnest(modules)) WHERE "roleId" = 'prestataire_sante';
