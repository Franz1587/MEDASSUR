-- Facturation multi-lignes + fiscalite gabonaise + tarification par
-- module (2026-09) -- voir demande utilisateur : "revoir le formulaire de
-- facturation... TVA (18%), TPS (9.5%), CSS (1%)... plusieurs lignes...
-- evaluer un cout pour chaque fonctionnalite... convertir en FCFA (XAF)".

-- Restructuration FactureAbonnement (0 ligne en base, aucune donnee reelle
-- a preserver -- voir verification prealable).
ALTER TABLE "FactureAbonnement" DROP COLUMN "montant",
ADD COLUMN     "montantCss" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "montantHT" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "montantTTC" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "montantTps" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "montantTva" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "numero" SERIAL NOT NULL,
ADD COLUMN     "tauxCss" DECIMAL(5,2),
ADD COLUMN     "tauxTps" DECIMAL(5,2),
ADD COLUMN     "tauxTva" DECIMAL(5,2);

CREATE TABLE "FactureAbonnementLigne" (
    "id" TEXT NOT NULL,
    "factureAbonnementId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "prixUnitaire" DECIMAL(18,2) NOT NULL,
    "montant" DECIMAL(18,2) NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FactureAbonnementLigne_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FactureAbonnementLigne_factureAbonnementId_idx" ON "FactureAbonnementLigne"("factureAbonnementId");
ALTER TABLE "FactureAbonnementLigne" ADD CONSTRAINT "FactureAbonnementLigne_factureAbonnementId_fkey" FOREIGN KEY ("factureAbonnementId") REFERENCES "FactureAbonnement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ModulePrix" (
    "module" TEXT NOT NULL,
    "prix" DECIMAL(12,2) NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModulePrix_pkey" PRIMARY KEY ("module")
);

CREATE TABLE "TauxChange" (
    "devise" TEXT NOT NULL,
    "tauxVersXaf" DECIMAL(10,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TauxChange_pkey" PRIMARY KEY ("devise")
);

-- Taux de change de depart (parite BEAC reelle pour l'EUR ; USD approximatif,
-- editable depuis l'ecran Super Admin -- aucun flux de cours en direct).
INSERT INTO "TauxChange" ("devise", "tauxVersXaf", "updatedAt") VALUES
  ('EUR', 655.9570, CURRENT_TIMESTAMP),
  ('USD', 600.0000, CURRENT_TIMESTAMP);

-- Tarification de depart par module, en EUR/mois.
INSERT INTO "ModulePrix" ("module", "prix", "devise", "updatedAt") VALUES
  ('dashboard', 0, 'EUR', CURRENT_TIMESTAMP),
  ('clients', 8, 'EUR', CURRENT_TIMESTAMP),
  ('compagnies', 8, 'EUR', CURRENT_TIMESTAMP),
  ('contrats', 8, 'EUR', CURRENT_TIMESTAMP),
  ('participants', 8, 'EUR', CURRENT_TIMESTAMP),
  ('messagerie', 8, 'EUR', CURRENT_TIMESTAMP),
  ('demandesClient', 8, 'EUR', CURRENT_TIMESTAMP),
  ('renouvellements', 15, 'EUR', CURRENT_TIMESTAMP),
  ('avenants', 15, 'EUR', CURRENT_TIMESTAMP),
  ('resiliations', 15, 'EUR', CURRENT_TIMESTAMP),
  ('prisesEnCharge', 15, 'EUR', CURRENT_TIMESTAMP),
  ('accordPrealable', 15, 'EUR', CURRENT_TIMESTAMP),
  ('sinistres', 15, 'EUR', CURRENT_TIMESTAMP),
  ('prestataires', 15, 'EUR', CURRENT_TIMESTAMP),
  ('reglementPrestataire', 15, 'EUR', CURRENT_TIMESTAMP),
  ('professionnelsSante', 15, 'EUR', CURRENT_TIMESTAMP),
  ('comptabilite', 15, 'EUR', CURRENT_TIMESTAMP),
  ('reglementComptable', 15, 'EUR', CURRENT_TIMESTAMP),
  ('garantiesCatalogue', 15, 'EUR', CURRENT_TIMESTAMP),
  ('cartesAssurance', 15, 'EUR', CURRENT_TIMESTAMP),
  ('actesMedicaux', 15, 'EUR', CURRENT_TIMESTAMP),
  ('parametresEntreprise', 15, 'EUR', CURRENT_TIMESTAMP),
  ('statistiques', 15, 'EUR', CURRENT_TIMESTAMP),
  ('crm', 25, 'EUR', CURRENT_TIMESTAMP),
  ('communications', 25, 'EUR', CURRENT_TIMESTAMP),
  ('appelOffres', 25, 'EUR', CURRENT_TIMESTAMP),
  ('cotation', 25, 'EUR', CURRENT_TIMESTAMP),
  ('autoGestion', 25, 'EUR', CURRENT_TIMESTAMP),
  ('sante', 25, 'EUR', CURRENT_TIMESTAMP),
  ('factureProduction', 25, 'EUR', CURRENT_TIMESTAMP),
  ('etatTps', 25, 'EUR', CURRENT_TIMESTAMP),
  ('commissions', 25, 'EUR', CURRENT_TIMESTAMP),
  ('recouvrement', 25, 'EUR', CURRENT_TIMESTAMP),
  ('tresorerie', 25, 'EUR', CURRENT_TIMESTAMP),
  ('fondsDeRoulement', 25, 'EUR', CURRENT_TIMESTAMP),
  ('honoraires', 25, 'EUR', CURRENT_TIMESTAMP),
  ('bordereauSinistres', 25, 'EUR', CURRENT_TIMESTAMP),
  ('bordereauProduction', 25, 'EUR', CURRENT_TIMESTAMP),
  ('bordereauEncaissement', 25, 'EUR', CURRENT_TIMESTAMP),
  ('ged', 25, 'EUR', CURRENT_TIMESTAMP),
  ('rapports', 25, 'EUR', CURRENT_TIMESTAMP),
  ('journalOperations', 25, 'EUR', CURRENT_TIMESTAMP),
  ('suiviAgents', 25, 'EUR', CURRENT_TIMESTAMP),
  ('courrierMaladie', 25, 'EUR', CURRENT_TIMESTAMP),
  ('lettresCles', 25, 'EUR', CURRENT_TIMESTAMP),
  ('modelesCourrier', 25, 'EUR', CURRENT_TIMESTAMP),
  ('reglesConsignes', 25, 'EUR', CURRENT_TIMESTAMP),
  ('banques', 25, 'EUR', CURRENT_TIMESTAMP),
  ('fraude', 25, 'EUR', CURRENT_TIMESTAMP),
  ('admin', 40, 'EUR', CURRENT_TIMESTAMP),
  ('ia', 40, 'EUR', CURRENT_TIMESTAMP),
  ('importDonnees', 40, 'EUR', CURRENT_TIMESTAMP);
