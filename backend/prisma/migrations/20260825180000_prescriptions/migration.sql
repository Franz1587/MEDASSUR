-- Médecin prescripteur : e-ordonnance / bon d'examen (2026-08) — voir
-- demande utilisateur. La consultation (PriseEnCharge de type Consultation
-- déjà facturée) reste l'origine de la Feuille de Soins ; la Prescription
-- la COMPLÈTE (numéro stable, voir numeroFeuilleSoins). Le bon d'examen
-- garde son propre numéro (numeroBonExamen), généré à la prescription.

ALTER TABLE "PriseEnCharge" ADD COLUMN "numeroFeuilleSoins" TEXT;
CREATE UNIQUE INDEX "PriseEnCharge_numeroFeuilleSoins_key" ON "PriseEnCharge"("numeroFeuilleSoins");

CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "priseEnChargeId" TEXT NOT NULL,
    "medecinId" TEXT NOT NULL,
    "motifConsultation" TEXT NOT NULL,
    "codeAffection" TEXT,
    "numeroBonExamen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Prescription_priseEnChargeId_key" ON "Prescription"("priseEnChargeId");
CREATE UNIQUE INDEX "Prescription_numeroBonExamen_key" ON "Prescription"("numeroBonExamen");

ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_priseEnChargeId_fkey" FOREIGN KEY ("priseEnChargeId") REFERENCES "PriseEnCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_medecinId_fkey" FOREIGN KEY ("medecinId") REFERENCES "Medecin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrescriptionLigne" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "acteMedicalId" TEXT,
    "libelle" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "posologie" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EnAttente',
    "prestataireTraitantId" TEXT,
    "priseEnChargeId" TEXT,
    "dateTraitement" TIMESTAMP(3),

    CONSTRAINT "PrescriptionLigne_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrescriptionLigne_prescriptionId_idx" ON "PrescriptionLigne"("prescriptionId");
CREATE UNIQUE INDEX "PrescriptionLigne_priseEnChargeId_key" ON "PrescriptionLigne"("priseEnChargeId");

ALTER TABLE "PrescriptionLigne" ADD CONSTRAINT "PrescriptionLigne_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrescriptionLigne" ADD CONSTRAINT "PrescriptionLigne_acteMedicalId_fkey" FOREIGN KEY ("acteMedicalId") REFERENCES "ActeMedical"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrescriptionLigne" ADD CONSTRAINT "PrescriptionLigne_prestataireTraitantId_fkey" FOREIGN KEY ("prestataireTraitantId") REFERENCES "Prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrescriptionLigne" ADD CONSTRAINT "PrescriptionLigne_priseEnChargeId_fkey" FOREIGN KEY ("priseEnChargeId") REFERENCES "PriseEnCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
