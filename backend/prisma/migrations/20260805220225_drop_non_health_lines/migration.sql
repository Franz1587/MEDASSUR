/*
  Warnings:

  - You are about to drop the `Beneficiaire` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ContratVie` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Flotte` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PoliceIard` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Vehicule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Beneficiaire" DROP CONSTRAINT "Beneficiaire_contratVieId_fkey";

-- DropForeignKey
ALTER TABLE "ContratVie" DROP CONSTRAINT "ContratVie_compagnieId_fkey";

-- DropForeignKey
ALTER TABLE "Flotte" DROP CONSTRAINT "Flotte_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Flotte" DROP CONSTRAINT "Flotte_compagnieId_fkey";

-- DropForeignKey
ALTER TABLE "Flotte" DROP CONSTRAINT "Flotte_contratId_fkey";

-- DropForeignKey
ALTER TABLE "PoliceIard" DROP CONSTRAINT "PoliceIard_clientId_fkey";

-- DropForeignKey
ALTER TABLE "PoliceIard" DROP CONSTRAINT "PoliceIard_compagnieId_fkey";

-- DropForeignKey
ALTER TABLE "Vehicule" DROP CONSTRAINT "Vehicule_flotteId_fkey";

-- DropTable
DROP TABLE "Beneficiaire";

-- DropTable
DROP TABLE "ContratVie";

-- DropTable
DROP TABLE "Flotte";

-- DropTable
DROP TABLE "PoliceIard";

-- DropTable
DROP TABLE "Vehicule";
