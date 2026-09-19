-- Super Admin enrichi (2026-09) -- voir demande utilisateur : "il doit
-- avoir son ecran de comptabilite... un ecran lui permettant de voir les
-- performances d'utilisation... un ecran de facturation afin de gerer...
-- les frais d'installation et... le paiement de licence d'utilisation par
-- mois, trimestre, semestre, annees".

-- Tarif de reference sur le plan.
ALTER TABLE "PlanAbonnement" ADD COLUMN "prixMensuel" DECIMAL(18,2);

-- Facturation par societe.
ALTER TABLE "SocieteAssurance" ADD COLUMN "cycleFacturation" TEXT NOT NULL DEFAULT 'Mensuel';
ALTER TABLE "SocieteAssurance" ADD COLUMN "prixAbonnement" DECIMAL(18,2);
ALTER TABLE "SocieteAssurance" ADD COLUMN "fraisInstallation" DECIMAL(18,2);

-- Factures de la plateforme envers ses societes clientes.
CREATE TABLE "FactureAbonnement" (
    "id" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "periodeDebut" TEXT,
    "periodeFin" TEXT,
    "montant" DECIMAL(18,2) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'Emise',
    "dateEmission" TEXT NOT NULL,
    "dateEcheance" TEXT NOT NULL,
    "datePaiement" TEXT,
    "modePaiement" TEXT,
    "referencePaiement" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactureAbonnement_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "FactureAbonnement" ADD CONSTRAINT "FactureAbonnement_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteAssurance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "FactureAbonnement_societeId_idx" ON "FactureAbonnement"("societeId");

-- Derniere connexion (performance / usage).
ALTER TABLE "User" ADD COLUMN "derniereConnexion" TIMESTAMP(3);

-- Cloisonnement du journal des operations par societe (comblait une fuite :
-- l'ecran interne "journalOperations" montrait l'activite de TOUTES les
-- societes). Backfill des lignes existantes vers la societe bootstrap,
-- meme principe que la Phase 2 (20260906130000_societe_scoping).
ALTER TABLE "AuditLog" ADD COLUMN "societeId" TEXT;
CREATE INDEX "AuditLog_societeId_idx" ON "AuditLog"("societeId");
UPDATE "AuditLog" SET "societeId" = 'societe-bootstrap' WHERE "societeId" IS NULL;
