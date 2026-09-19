-- Licence annuelle par assure + frais de carte (2026-09) -- voir demande
-- utilisateur : "la licence annuelle par assure. C'est un montant minimum
-- de 5000 pour assure y compris les ayants droit... on facture la carte
-- par assure et ayant droit. Le montant par defaut est 2500 par personne."

CREATE TABLE "ParametresFacturationPlateforme" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "licenceAnnuellePersonne" DECIMAL(12,2) NOT NULL DEFAULT 5000,
    "carteParPersonne" DECIMAL(12,2) NOT NULL DEFAULT 2500,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametresFacturationPlateforme_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ParametresFacturationPlateforme" ("id", "licenceAnnuellePersonne", "carteParPersonne", "updatedAt")
VALUES ('default', 5000, 2500, CURRENT_TIMESTAMP);
