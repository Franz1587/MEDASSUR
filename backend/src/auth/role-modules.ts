import type { RoleId } from "./role.enum";

// Miroir de src/auth/roles.ts (allowedModules, frontend) — sert de modèle
// PAR DÉFAUT quand un utilisateur est créé (voir UsersService.create) ou
// pour le seed initial (voir prisma/seed.ts). Une fois l'utilisateur créé,
// User.modules devient la seule source d'autorité pour son accès réel
// (voir demande utilisateur : "c'est l'administrateur qui donne les droits
// aux fonctionnalités") — ce mapping n'est plus relu ensuite pour lui.
const dashboard = ["dashboard"];
export const ALL_VIEWS = [
  "dashboard", "sante", "crm", "clients", "compagnies", "autoGestion",
  "contrats", "renouvellements", "avenants",
  "resiliations", "sinistres", "participants",
  "prisesEnCharge", "accordPrealable", "fraude",
  "prestataires", "reglementPrestataire", "etatTps", "reglementComptable",
  "comptabilite", "commissions", "recouvrement",
  "tresorerie", "ged", "ia", "rapports", "admin",
  "appelOffres", "cotation",
  "fondsDeRoulement", "honoraires", "garantiesCatalogue", "cartesAssurance",
  "actesMedicaux", "professionnelsSante", "lettresCles",
  "journalOperations", "suiviAgents",
  "factureProduction",
  "courrierMaladie", "modelesCourrier",
  "statistiques",
  "parametresEntreprise",
  "demandesClient",
  "reglesConsignes",
  "banques",
  "importDonnees",
  "bordereauSinistres",
  "bordereauProduction",
  "bordereauEncaissement",
  "messagerie",
  "communications",
];


export const ROLE_MODULES: Record<RoleId, string[]> = {
  administrateur: ALL_VIEWS,
  direction_generale: ALL_VIEWS,
  directeur_technique: [...dashboard, "contrats", "renouvellements", "avenants", "resiliations", "participants", "prisesEnCharge", "accordPrealable", "actesMedicaux", "professionnelsSante", "lettresCles", "journalOperations", "suiviAgents", "fraude", "prestataires", "reglementPrestataire", "reglementComptable", "etatTps", "cotation", "rapports", "garantiesCatalogue", "cartesAssurance", "factureProduction", "courrierMaladie", "modelesCourrier", "statistiques", "demandesClient", "reglesConsignes", "banques", "bordereauSinistres", "bordereauProduction", "bordereauEncaissement", "messagerie"],
  gestionnaire_production: [...dashboard, "clients", "compagnies", "autoGestion", "appelOffres", "cotation", "contrats", "renouvellements", "avenants", "resiliations", "participants", "garantiesCatalogue", "cartesAssurance", "factureProduction", "courrierMaladie", "demandesClient", "messagerie"],
  gestionnaire_sinistres: [...dashboard, "prisesEnCharge", "accordPrealable", "actesMedicaux", "professionnelsSante", "lettresCles", "journalOperations", "suiviAgents", "fraude", "clients", "ged", "courrierMaladie", "messagerie"],
  gestionnaire_sante: [...dashboard, "contrats", "renouvellements", "avenants", "resiliations", "participants", "prisesEnCharge", "accordPrealable", "actesMedicaux", "professionnelsSante", "lettresCles", "journalOperations", "suiviAgents", "fraude", "prestataires", "reglementPrestataire", "reglementComptable", "etatTps", "clients", "ged", "garantiesCatalogue", "cartesAssurance", "courrierMaladie", "messagerie"],
  gestionnaire_entreprises: [...dashboard, "clients", "compagnies", "autoGestion", "crm", "communications", "contrats", "messagerie"],
  comptable: [...dashboard, "comptabilite", "reglementComptable", "commissions", "recouvrement", "tresorerie", "fondsDeRoulement", "honoraires", "rapports", "banques", "bordereauSinistres", "bordereauProduction", "bordereauEncaissement", "messagerie"],
  commercial: [...dashboard, "crm", "communications", "clients", "appelOffres", "compagnies", "cotation", "messagerie"],
  agent_recouvrement: [...dashboard, "recouvrement", "clients", "contrats", "messagerie"],
  courtier_partenaire: [...dashboard, "clients", "contrats", "commissions", "messagerie"],
  compagnie_assurance: [...dashboard, "compagnies", "contrats", "messagerie"],
  // Portail prestataire (2026-08) — voir demande utilisateur : "portail
  // externe dédié au prestataire médical", modelé sur une capture de
  // référence fournie par l'utilisateur.
  // prestataireDashboard reste TOUJOURS en premier (voir prestataireDashboard
  // ci-dessous, sert de page d'accueil après connexion).
  // "prestataireMedecinPrescripteur" retiré (2026-08) — voir demande
  // utilisateur : "le médecin doit avoir ses accès différents de ceux de
  // la clinique ou l'hôpital... c'est sensible" — cet écran est désormais
  // exclusif au rôle medecin_prescripteur ci-dessous, jamais accessible
  // depuis le compte de la structure elle-même.
  prestataire_sante: ["prestataireDashboard", "prestatairePatients", "prestatairePrestations", "prestataireTraiterBon", "prestataireContacts", "prestataireDevis", "prestataireFinance", "prestataireLogistique", "messagerie"],
  expert_sinistres: [...dashboard, "sinistres", "messagerie"],
  // Portail client (2026-08) — écrans dédiés et cloisonnés au Client
  // rattaché (User.clientId), distincts des vues internes "contrats"/
  // "participants"/"statistiques" (voir demande utilisateur : les vues
  // internes ne sont pas cloisonnées par client, un portail dédié l'est).
  client_particulier: ["portailDashboard", "portailContrats", "portailParticipants", "portailDemandes", "portailReseauSoins", "portailReglesConsignes", "portailUtilisateurs", "messagerie", "portailStatistiques"],
  client_entreprise: ["portailDashboard", "portailContrats", "portailParticipants", "portailDemandes", "portailReseauSoins", "portailReglesConsignes", "portailUtilisateurs", "messagerie", "portailStatistiques"],
  // Portail assuré (2026-08) — écrans cloisonnés à UN SEUL AssureSante
  // (User.assureSanteId), voir demande utilisateur : "écran externe dédié à
  // l'assuré principal", rendu par le même shell à sidebar que le portail
  // client (PortalShell.tsx). membreDashboard reste TOUJOURS en premier.
  // membreDelegations (2026-08) — voir demande utilisateur : "l'assuré
  // principal doit pouvoir donner des droits à un des membres de la
  // famille". Réservé à l'assuré principal racine : jamais accordable à un
  // ayant droit délégué (voir DelegationsFamilleService.MODULES_DELEGABLES,
  // qui l'exclut explicitement de la liste des rubriques accordables).
  assure_principal: ["membreDashboard", "membreCarte", "membreGaranties", "membrePriseEnCharge", "membreRemboursement", "membreReseauSoins", "membreCarnetSante", "membreHistorique", "membreFamille", "membreDelegations", "messagerie"],
  // Portail médecin (2026-08) — voir demande utilisateur : "le médecin doit
  // avoir ses accès différents de ceux de la clinique ou l'hôpital... il
  // n'a pas besoin d'identifier un assuré, il doit voir la liste des
  // assurés qu'il doit recevoir (une file d'attente)". Compte distinct
  // (User.medecinId), pas rattaché à un Prestataire. medecinDashboard
  // reste TOUJOURS en premier (page d'accueil) — voir demande utilisateur :
  // "dossier médical de chaque patient... Historique des prestations... un
  // tableau de bord avec des statistiques".
  medecin_prescripteur: [
    "medecinDashboard", "medecinFileAttente", "prestataireMedecinPrescripteur",
    "medecinDossiersPatients", "medecinHistoriquePrestations", "messagerie",
  ],
  // Super Admin (2026-09) — voir src/auth/role.enum.ts. superAdminDashboard
  // reste TOUJOURS en premier (page d'accueil).
  super_admin: ["superAdminDashboard", "superAdminSocietes", "superAdminUtilisateurs", "superAdminPlans", "superAdminFacturation", "superAdminPerformance", "superAdminTarification", "superAdminModelesCarte"],
};
