/*
  Warnings:

  - You are about to drop the column `prixAbonnementIndividuelXaf` on the `SocieteAssurance` table. All the data in the column will be lost.
  - You are about to drop the column `consentementAccepteAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `AbonnementIndividuel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AbonnementIndividuel" DROP CONSTRAINT "AbonnementIndividuel_assureId_fkey";

-- DropForeignKey
ALTER TABLE "AbonnementIndividuel" DROP CONSTRAINT "AbonnementIndividuel_societeId_fkey";

-- DropForeignKey
ALTER TABLE "Compagnie" DROP CONSTRAINT "Compagnie_clientId_fkey";

-- DropIndex
DROP INDEX "Facture_agenceId_idx";

-- DropIndex
DROP INDEX "Remboursement_agenceId_idx";

-- AlterTable
ALTER TABLE "SocieteAssurance" DROP COLUMN "prixAbonnementIndividuelXaf";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "consentementAccepteAt";

-- DropTable
DROP TABLE "AbonnementIndividuel";

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'created',
    "ebillingId" TEXT,
    "payoutId" TEXT,
    "operateur" TEXT,
    "transactionIdOperateur" TEXT,
    "payeurMsisdn" TEXT,
    "payeurNom" TEXT,
    "payeurEmail" TEXT,
    "contratId" TEXT,
    "prestataireId" TEXT,
    "gestionnaireId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Transaction_societeId_idx" ON "Transaction"("societeId");

-- CreateIndex
CREATE INDEX "Transaction_statut_idx" ON "Transaction"("statut");

-- AddForeignKey
ALTER TABLE "Compagnie" ADD CONSTRAINT "Compagnie_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccordPrealable" ADD CONSTRAINT "AccordPrealable_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
