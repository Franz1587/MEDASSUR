-- Rubriques de facturation (2026-09) -- voir demande utilisateur : "le
-- type de facture n'est pas les rubriques de facture. les rubriques font
-- reference aux differentes lignes de facturation (installation, licence,
-- carte, recuperation de donnees...)."

ALTER TABLE "FactureAbonnementLigne" ADD COLUMN "rubriqueCode" TEXT;

CREATE TABLE "RubriqueFacturation" (
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "prixDefaut" DECIMAL(18,2),
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RubriqueFacturation_pkey" PRIMARY KEY ("code")
);

INSERT INTO "RubriqueFacturation" ("code", "libelle", "prixDefaut", "ordre") VALUES
  ('installation', 'Frais d''installation', NULL, 1),
  ('licence-annuelle', 'Licence annuelle par assuré', NULL, 2),
  ('carte-assurance', 'Carte d''assurance', 2500, 3),
  ('abonnement-modules', 'Abonnement — modules souscrits', NULL, 4),
  ('recuperation-donnees', 'Récupération de données', NULL, 5),
  ('formation', 'Formation des utilisateurs', NULL, 6),
  ('personnalisation', 'Personnalisation / développement spécifique', NULL, 7),
  ('support-technique', 'Support technique', NULL, 8),
  ('autre', 'Autre', NULL, 99);
