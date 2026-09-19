-- Appels d'offres : import de documents réels, Cotation reciblée sur le
-- vrai document d'offre assureur (Prime NETTE + Cartes + Accessoires +
-- Taxe, tableau de garanties, clause d'ajustement...) au lieu du simulateur
-- actuariel précédent (chargements/marge/commission/PEPM), catalogue de
-- garanties éditable par compagnie, contact prestataire (2026-08).
-- Cotation : 2 lignes en base, aucune valeur métier à préserver — recréée.

-- ── AppelOffresDocument (nouveau) ──────────────────────────────────────
CREATE TABLE "AppelOffresDocument" (
    "id" TEXT NOT NULL,
    "appelOffresId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "fichier" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "compagnieId" TEXT,
    "tailleOctets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppelOffresDocument_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AppelOffresDocument" ADD CONSTRAINT "AppelOffresDocument_appelOffresId_fkey" FOREIGN KEY ("appelOffresId") REFERENCES "AppelOffres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppelOffresDocument" ADD CONSTRAINT "AppelOffresDocument_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── GarantieCatalogue : compagnieId (null = suggestion générique) ─────
ALTER TABLE "GarantieCatalogue" ADD COLUMN "compagnieId" TEXT;
ALTER TABLE "GarantieCatalogue" ADD CONSTRAINT "GarantieCatalogue_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Compagnie : valeurs par défaut pour pré-remplir une Cotation ──────
ALTER TABLE "Compagnie" ADD COLUMN "plafondFamilialDefaut" DECIMAL(18,2);
ALTER TABLE "Compagnie" ADD COLUMN "limiteAgeAdulteDefaut" INTEGER;
ALTER TABLE "Compagnie" ADD COLUMN "limiteAgeEnfantDefaut" INTEGER;

-- ── Prestataire : contact (annexe "structures conventionnées") ───────
ALTER TABLE "Prestataire" ADD COLUMN "telephone" TEXT;
ALTER TABLE "Prestataire" ADD COLUMN "adresse" TEXT;

-- ── Cotation : reciblée sur le vrai document d'offre assureur ─────────
DROP TABLE "Cotation";

CREATE TABLE "Cotation" (
    "id" TEXT NOT NULL,
    "branche" TEXT NOT NULL,
    "clientNom" TEXT NOT NULL,
    "population" INTEGER NOT NULL,
    "territorialite" TEXT NOT NULL,
    "exclusions" TEXT,
    "clauseAjustement" TEXT,
    "limiteAgeAdulte" INTEGER,
    "limiteAgeEnfant" INTEGER,
    "plafondFamilial" DECIMAL(18,2),
    "conditionsFermete" TEXT,
    "primeNette" DECIMAL(18,2) NOT NULL,
    "montantCartes" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "montantAccessoires" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "montantTaxe" DECIMAL(18,2) NOT NULL,
    "primeTTC" DECIMAL(18,2) NOT NULL,
    "dateCreation" TEXT NOT NULL,
    "appelOffresId" TEXT,
    "compagnieId" TEXT,
    "propositionId" TEXT,

    CONSTRAINT "Cotation_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Cotation" ADD CONSTRAINT "Cotation_appelOffresId_fkey" FOREIGN KEY ("appelOffresId") REFERENCES "AppelOffres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cotation" ADD CONSTRAINT "Cotation_compagnieId_fkey" FOREIGN KEY ("compagnieId") REFERENCES "Compagnie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cotation" ADD CONSTRAINT "Cotation_propositionId_fkey" FOREIGN KEY ("propositionId") REFERENCES "PropositionCommerciale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── CotationGarantieLigne (nouveau) ────────────────────────────────────
CREATE TABLE "CotationGarantieLigne" (
    "id" TEXT NOT NULL,
    "cotationId" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "plafond" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CotationGarantieLigne_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "CotationGarantieLigne" ADD CONSTRAINT "CotationGarantieLigne_cotationId_fkey" FOREIGN KEY ("cotationId") REFERENCES "Cotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
