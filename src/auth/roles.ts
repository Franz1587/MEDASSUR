import { allViews, type View } from "@/layout/navConfig";

export type RoleId =
  | "super_admin"
  | "administrateur" | "direction_generale" | "directeur_technique"
  | "gestionnaire_production" | "gestionnaire_sinistres" | "gestionnaire_sante"
  | "gestionnaire_entreprises"
  | "comptable" | "commercial" | "agent_recouvrement"
  | "courtier_partenaire" | "compagnie_assurance" | "prestataire_sante"
  | "expert_sinistres" | "client_particulier" | "client_entreprise" | "assure_principal"
  | "medecin_prescripteur";

/**
 * Phase 4a keeps every role inside the single ERP shell (nav filtered by
 * allowedModules). Phase 4b will route the "externe" family to dedicated
 * portal shells instead — the `shell` field here is already forward-looking
 * for that split.
 *
 * "super-admin-portal" (2026-09) — voir demande utilisateur : "créer un
 * compte, et un interface pour le super Admin... propriétaire de
 * l'application". Phase 1 d'un chantier multi-tenant (voir SocieteAssurance,
 * backend/prisma/schema.prisma) — écran dédié, jamais mélangé au shell
 * "erp" des sociétés (le Super Admin n'appartient à AUCUNE société).
 */
export type ShellId = "erp" | "client-portal" | "partner-portal" | "company-portal" | "provider-portal" | "expert-portal" | "member-portal" | "medecin-portal" | "super-admin-portal";

export interface RoleDefinition {
  id: RoleId;
  label: string;
  family: "interne" | "externe";
  shell: ShellId;
  allowedModules: View[];
}

const dashboard: View[] = ["dashboard"];

export const roles: Record<RoleId, RoleDefinition> = {
  // Super Admin (2026-09) — voir src/auth/roles.ts ShellId ci-dessus.
  // superAdminDashboard reste TOUJOURS en premier (page d'accueil).
  super_admin: {
    id: "super_admin", label: "Super Admin", family: "interne", shell: "super-admin-portal",
    allowedModules: ["superAdminDashboard", "superAdminSocietes", "superAdminUtilisateurs", "superAdminPlans", "superAdminFacturation", "superAdminPerformance", "superAdminTarification", "superAdminModelesCarte"],
  },
  administrateur: {
    id: "administrateur", label: "Administrateur", family: "interne", shell: "erp",
    allowedModules: allViews,
  },
  direction_generale: {
    id: "direction_generale", label: "Direction Générale", family: "interne", shell: "erp",
    allowedModules: allViews,
  },
  directeur_technique: {
    id: "directeur_technique", label: "Directeur Technique", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "contrats", "renouvellements", "avenants", "resiliations", "participants", "prisesEnCharge", "accordPrealable", "actesMedicaux", "professionnelsSante", "lettresCles", "journalOperations", "suiviAgents", "fraude", "prestataires", "reglementPrestataire", "reglementComptable", "etatTps", "cotation", "rapports", "garantiesCatalogue", "cartesAssurance", "factureProduction", "courrierMaladie", "modelesCourrier", "statistiques", "demandesClient", "reglesConsignes", "banques", "agences", "bordereauSinistres", "bordereauProduction", "bordereauEncaissement", "messagerie"],
  },
  gestionnaire_production: {
    id: "gestionnaire_production", label: "Gestionnaire Production", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "clients", "compagnies", "autoGestion", "appelOffres", "cotation", "contrats", "renouvellements", "avenants", "resiliations", "participants", "garantiesCatalogue", "cartesAssurance", "factureProduction", "courrierMaladie", "demandesClient", "messagerie"],
  },
  gestionnaire_sinistres: {
    id: "gestionnaire_sinistres", label: "Gestionnaire Sinistres", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "prisesEnCharge", "accordPrealable", "actesMedicaux", "professionnelsSante", "lettresCles", "journalOperations", "suiviAgents", "fraude", "clients", "ged", "courrierMaladie", "messagerie"],
  },
  gestionnaire_sante: {
    id: "gestionnaire_sante", label: "Gestionnaire Santé", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "contrats", "renouvellements", "avenants", "resiliations", "participants", "prisesEnCharge", "accordPrealable", "actesMedicaux", "professionnelsSante", "lettresCles", "journalOperations", "suiviAgents", "fraude", "prestataires", "reglementPrestataire", "reglementComptable", "etatTps", "clients", "ged", "garantiesCatalogue", "cartesAssurance", "courrierMaladie", "messagerie"],
  },
  gestionnaire_entreprises: {
    id: "gestionnaire_entreprises", label: "Gestionnaire Entreprises", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "clients", "compagnies", "autoGestion", "crm", "communications", "contrats", "messagerie"],
  },
  comptable: {
    id: "comptable", label: "Comptable", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "comptabilite", "reglementComptable", "commissions", "recouvrement", "tresorerie", "fondsDeRoulement", "honoraires", "rapports", "banques", "agences", "bordereauSinistres", "bordereauProduction", "bordereauEncaissement", "messagerie"],
  },
  commercial: {
    id: "commercial", label: "Commercial", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "crm", "communications", "clients", "appelOffres", "compagnies", "cotation", "messagerie"],
  },
  agent_recouvrement: {
    id: "agent_recouvrement", label: "Agent de Recouvrement", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "recouvrement", "clients", "contrats", "messagerie"],
  },
  courtier_partenaire: {
    id: "courtier_partenaire", label: "Courtier Partenaire", family: "externe", shell: "partner-portal",
    allowedModules: [...dashboard, "clients", "contrats", "commissions", "messagerie"],
  },
  compagnie_assurance: {
    id: "compagnie_assurance", label: "Compagnie d'Assurance", family: "externe", shell: "company-portal",
    allowedModules: [...dashboard, "compagnies", "contrats", "messagerie"],
  },
  // Portail prestataire (2026-08) — écran externe dédié au prestataire
  // médical (User.prestataireId), modelé sur des captures de référence
  // fournies par l'utilisateur (voir demande utilisateur : "duplique cela").
  // prestataireDashboard reste TOUJOURS en premier.
  // "prestataireMedecinPrescripteur" retiré (2026-08) — voir demande
  // utilisateur : "le médecin doit avoir ses accès différents de ceux de
  // la clinique ou l'hôpital... c'est sensible" — écran désormais exclusif
  // au rôle medecin_prescripteur ci-dessous.
  prestataire_sante: {
    id: "prestataire_sante", label: "Prestataire de Santé", family: "externe", shell: "provider-portal",
    allowedModules: ["prestataireDashboard", "prestatairePatients", "prestatairePrestations", "prestataireTraiterBon", "prestataireContacts", "prestataireDevis", "prestataireFinance", "prestataireLogistique", "messagerie"],
  },
  expert_sinistres: {
    id: "expert_sinistres", label: "Expert Sinistres", family: "externe", shell: "expert-portal",
    allowedModules: [...dashboard, "sinistres", "messagerie"],
  },
  // Portail client (2026-08) — écrans dédiés et cloisonnés au Client
  // rattaché (User.clientId), distincts des vues internes "contrats"/
  // "sinistres" (non cloisonnées par client) qu'ils remplacent ici.
  client_particulier: {
    id: "client_particulier", label: "Client Particulier", family: "externe", shell: "client-portal",
    // "portailStatistiques" reste TOUJOURS en dernier (voir demande
    // utilisateur) — tout nouvel écran portail s'insère avant lui.
    allowedModules: ["portailDashboard", "portailContrats", "portailParticipants", "portailDemandes", "portailReseauSoins", "portailReglesConsignes", "portailUtilisateurs", "messagerie", "portailStatistiques"],
  },
  client_entreprise: {
    id: "client_entreprise", label: "Client Entreprise", family: "externe", shell: "client-portal",
    allowedModules: ["portailDashboard", "portailContrats", "portailParticipants", "portailDemandes", "portailReseauSoins", "portailReglesConsignes", "portailUtilisateurs", "messagerie", "portailStatistiques"],
  },
  // Portail assuré (2026-08) — écran externe dédié à l'assuré principal
  // (individu, User.assureSanteId), distinct du portail client ci-dessus
  // (souscripteur entreprise). Même shell "client-portal" style (sidebar,
  // voir demande utilisateur : "doit être semblable à celui du client et
  // non un aspect mobile") — rendu par PortalShell.tsx comme les autres
  // portails. membreDashboard reste TOUJOURS en premier dans la liste.
  assure_principal: {
    id: "assure_principal", label: "Assuré Principal", family: "externe", shell: "member-portal",
    allowedModules: ["membreDashboard", "membreCarte", "membreGaranties", "membrePriseEnCharge", "membreRemboursement", "membreReseauSoins", "membreCarnetSante", "membreHistorique", "membreFamille", "membreDelegations", "messagerie"],
  },
  // Portail médecin (2026-08) — voir demande utilisateur : "le médecin doit
  // avoir ses accès différents de ceux de la clinique ou l'hôpital... il
  // n'a pas besoin d'identifier un assuré, il doit voir la liste des
  // assurés qu'il doit recevoir (une file d'attente)". Compte distinct
  // (User.medecinId), pas rattaché à un Prestataire — shell dédié rendu
  // par le même PortalShell.tsx générique que les autres portails.
  // medecinDashboard reste TOUJOURS en premier (page d'accueil) — voir
  // demande utilisateur : "dossier médical de chaque patient... Historique
  // des prestations... un tableau de bord avec des statistiques".
  medecin_prescripteur: {
    id: "medecin_prescripteur", label: "Médecin Prescripteur", family: "externe", shell: "medecin-portal",
    allowedModules: [
      "medecinDashboard", "medecinFileAttente", "prestataireMedecinPrescripteur",
      "medecinDossiersPatients", "medecinHistoriquePrestations", "messagerie",
    ],
  },
};

export const roleList = Object.values(roles);
