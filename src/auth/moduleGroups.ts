import type { View } from "@/layout/navConfig";

// Regroupement des fonctionnalités "back-office" (2026-08, étendu 2026-09) —
// reproduit les 8 zones du menu réel (voir src/features/sante/admin/
// AdminShell.tsx zoneSections), même libellés/regroupement — utilisé par :
// - l'écran "Droits" par utilisateur (src/features/admin/index.tsx) ;
// - le modèle générique par rôle (RoleModuleTemplate) ;
// - l'abonnement d'une société (2026-09, voir demande utilisateur : "il
//   revient au super Admin de donner accès à ces modules là en fonction du
//   type d'abonnement souscrit" — src/features/super-admin/).
// EXHAUSTIF sur les modules internes/back-office (miroir de ALL_VIEWS côté
// backend, voir backend/src/auth/role-modules.ts) — les vues des portails
// externes (client/membre/prestataire/médecin/super-admin) n'y figurent
// PAS : elles sont structurelles au type de compte, pas un choix
// d'abonnement de la société.
export const GROUPES_MODULES: { label: string; views: View[] }[] = [
  { label: "Accueil", views: ["dashboard"] },
  { label: "Commercial", views: ["crm", "communications", "clients", "appelOffres", "cotation"] },
  { label: "Production", views: ["sante", "contrats", "renouvellements", "avenants", "resiliations", "participants", "factureProduction", "demandesClient"] },
  { label: "Factures & Prises en charge", views: ["prisesEnCharge", "accordPrealable", "sinistres"] },
  { label: "Réseau de Soins", views: ["prestataires", "reglementPrestataire", "professionnelsSante"] },
  { label: "Finance", views: ["comptabilite", "reglementComptable", "etatTps", "commissions", "recouvrement", "tresorerie", "fondsDeRoulement", "honoraires", "bordereauSinistres", "bordereauProduction", "bordereauEncaissement"] },
  { label: "Outils", views: ["ged", "ia", "rapports", "journalOperations", "suiviAgents", "statistiques", "courrierMaladie", "messagerie", "rapportsIa"] },
  { label: "Système", views: ["admin", "parametresEntreprise", "compagnies", "autoGestion", "garantiesCatalogue", "cartesAssurance", "actesMedicaux", "lettresCles", "modelesCourrier", "fraude", "reglesConsignes", "banques", "agences", "importDonnees"] },
];

export const TOUS_LES_MODULES: View[] = GROUPES_MODULES.flatMap((g) => g.views);
