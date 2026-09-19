-- Plans d'abonnement (2026-09) -- voir demande utilisateur : "il revient
-- au super Admin de donner acces a ces modules la en fonction du type
-- d'abonnement souscrit". Catalogue de plans nommes geres par le Super
-- Admin (voir PlanAbonnementService) ; SocieteAssurance.modules est la
-- source d'autorite REELLE consultee pour plafonner ce qu'un administrateur
-- de societe peut accorder a ses propres utilisateurs (voir
-- UsersService.plafonnerModules) -- un plan ne fait que PRE-REMPLIR ce
-- champ, jamais le relire ensuite (meme principe que RoleModuleTemplate).

CREATE TABLE "PlanAbonnement" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanAbonnement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlanAbonnement_nom_key" ON "PlanAbonnement"("nom");

ALTER TABLE "SocieteAssurance" ADD COLUMN "planAbonnementId" TEXT;
ALTER TABLE "SocieteAssurance" ADD COLUMN "modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "SocieteAssurance" ADD CONSTRAINT "SocieteAssurance_planAbonnementId_fkey" FOREIGN KEY ("planAbonnementId") REFERENCES "PlanAbonnement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "SocieteAssurance_planAbonnementId_idx" ON "SocieteAssurance"("planAbonnementId");

-- 3 plans de depart, librement modifiables/supprimables ensuite depuis
-- l'ecran Super Admin -- une suggestion raisonnable, pas une decision figee.
INSERT INTO "PlanAbonnement" ("id", "nom", "modules", "ordre") VALUES
  ('plan-essentiel', 'Essentiel', ARRAY['dashboard','clients','compagnies','contrats','renouvellements','avenants','resiliations','participants','prisesEnCharge','accordPrealable','sinistres','prestataires','reglementPrestataire','professionnelsSante','comptabilite','reglementComptable','garantiesCatalogue','cartesAssurance','actesMedicaux','parametresEntreprise','messagerie','statistiques','demandesClient']::text[], 1),
  ('plan-business', 'Business', ARRAY['dashboard','sante','crm','clients','compagnies','autoGestion','contrats','renouvellements','avenants','resiliations','sinistres','participants','prisesEnCharge','accordPrealable','fraude','prestataires','reglementPrestataire','etatTps','reglementComptable','comptabilite','commissions','recouvrement','tresorerie','ged','rapports','appelOffres','cotation','fondsDeRoulement','honoraires','garantiesCatalogue','cartesAssurance','actesMedicaux','professionnelsSante','lettresCles','journalOperations','suiviAgents','factureProduction','courrierMaladie','modelesCourrier','statistiques','parametresEntreprise','demandesClient','reglesConsignes','banques','bordereauSinistres','bordereauProduction','bordereauEncaissement','messagerie','communications']::text[], 2),
  ('plan-premium', 'Premium', ARRAY['dashboard','sante','crm','clients','compagnies','autoGestion','contrats','renouvellements','avenants','resiliations','sinistres','participants','prisesEnCharge','accordPrealable','fraude','prestataires','reglementPrestataire','etatTps','reglementComptable','comptabilite','commissions','recouvrement','tresorerie','ged','ia','rapports','admin','appelOffres','cotation','fondsDeRoulement','honoraires','garantiesCatalogue','cartesAssurance','actesMedicaux','professionnelsSante','lettresCles','journalOperations','suiviAgents','factureProduction','courrierMaladie','modelesCourrier','statistiques','parametresEntreprise','demandesClient','reglesConsignes','banques','importDonnees','bordereauSinistres','bordereauProduction','bordereauEncaissement','messagerie','communications']::text[], 3);

-- La societe bootstrap recoit le plan Premium (tous les modules) pour ne
-- rien retirer aux utilisateurs internes deja en place.
UPDATE "SocieteAssurance" SET "planAbonnementId" = 'plan-premium', "modules" = ARRAY['dashboard','sante','crm','clients','compagnies','autoGestion','contrats','renouvellements','avenants','resiliations','sinistres','participants','prisesEnCharge','accordPrealable','fraude','prestataires','reglementPrestataire','etatTps','reglementComptable','comptabilite','commissions','recouvrement','tresorerie','ged','ia','rapports','admin','appelOffres','cotation','fondsDeRoulement','honoraires','garantiesCatalogue','cartesAssurance','actesMedicaux','professionnelsSante','lettresCles','journalOperations','suiviAgents','factureProduction','courrierMaladie','modelesCourrier','statistiques','parametresEntreprise','demandesClient','reglesConsignes','banques','importDonnees','bordereauSinistres','bordereauProduction','bordereauEncaissement','messagerie','communications']::text[] WHERE "id" = 'societe-bootstrap';
