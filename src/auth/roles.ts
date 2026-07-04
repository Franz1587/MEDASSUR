import { allViews, type View } from "@/layout/navConfig";

export type RoleId =
  | "administrateur" | "direction_generale" | "directeur_technique"
  | "gestionnaire_production" | "gestionnaire_sinistres" | "gestionnaire_sante"
  | "gestionnaire_vie" | "gestionnaire_flotte" | "gestionnaire_entreprises"
  | "comptable" | "commercial" | "agent_recouvrement"
  | "courtier_partenaire" | "compagnie_assurance" | "prestataire_sante"
  | "expert_auto" | "expert_sinistres" | "client_particulier" | "client_entreprise";

/**
 * Phase 4a keeps every role inside the single ERP shell (nav filtered by
 * allowedModules). Phase 4b will route the "externe" family to dedicated
 * portal shells instead — the `shell` field here is already forward-looking
 * for that split.
 */
export type ShellId = "erp" | "client-portal" | "partner-portal" | "company-portal" | "provider-portal" | "expert-portal";

export interface RoleDefinition {
  id: RoleId;
  label: string;
  family: "interne" | "externe";
  shell: ShellId;
  allowedModules: View[];
}

const dashboard: View[] = ["dashboard"];

export const roles: Record<RoleId, RoleDefinition> = {
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
    allowedModules: [...dashboard, "contrats", "renouvellements", "avenants", "resiliations", "iard", "vie", "flotte", "sinistres", "sante", "comparateur", "rapports", "cotation", "prestataires", "accordPrealable", "fraude"],
  },
  gestionnaire_production: {
    id: "gestionnaire_production", label: "Gestionnaire Production", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "clients", "compagnies", "devis", "appelOffres", "cotation", "comparateur", "contrats", "renouvellements", "avenants", "resiliations", "iard", "vie", "flotte"],
  },
  gestionnaire_sinistres: {
    id: "gestionnaire_sinistres", label: "Gestionnaire Sinistres", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "sinistres", "clients", "ged", "rapports"],
  },
  gestionnaire_sante: {
    id: "gestionnaire_sante", label: "Gestionnaire Santé", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "sante", "clients", "ged", "prestataires", "accordPrealable", "fraude"],
  },
  gestionnaire_vie: {
    id: "gestionnaire_vie", label: "Gestionnaire Vie", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "vie", "clients", "devis"],
  },
  gestionnaire_flotte: {
    id: "gestionnaire_flotte", label: "Gestionnaire Flotte Automobile", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "flotte", "sinistres", "clients"],
  },
  gestionnaire_entreprises: {
    id: "gestionnaire_entreprises", label: "Gestionnaire Entreprises", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "clients", "compagnies", "contrats", "devis", "crm"],
  },
  comptable: {
    id: "comptable", label: "Comptable", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "comptabilite", "commissions", "tresorerie", "fondsDeRoulement", "honoraires", "rapports"],
  },
  commercial: {
    id: "commercial", label: "Commercial", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "crm", "clients", "devis", "appelOffres", "comparateur", "compagnies"],
  },
  agent_recouvrement: {
    id: "agent_recouvrement", label: "Agent de Recouvrement", family: "interne", shell: "erp",
    allowedModules: [...dashboard, "recouvrement", "clients", "contrats"],
  },
  courtier_partenaire: {
    id: "courtier_partenaire", label: "Courtier Partenaire", family: "externe", shell: "partner-portal",
    allowedModules: [...dashboard, "clients", "contrats", "commissions"],
  },
  compagnie_assurance: {
    id: "compagnie_assurance", label: "Compagnie d'Assurance", family: "externe", shell: "company-portal",
    allowedModules: [...dashboard, "compagnies", "contrats", "devis"],
  },
  prestataire_sante: {
    id: "prestataire_sante", label: "Prestataire de Santé", family: "externe", shell: "provider-portal",
    allowedModules: [...dashboard, "sante"],
  },
  expert_auto: {
    id: "expert_auto", label: "Expert Automobile", family: "externe", shell: "expert-portal",
    allowedModules: [...dashboard, "sinistres", "flotte"],
  },
  expert_sinistres: {
    id: "expert_sinistres", label: "Expert Sinistres", family: "externe", shell: "expert-portal",
    allowedModules: [...dashboard, "sinistres"],
  },
  client_particulier: {
    id: "client_particulier", label: "Client Particulier", family: "externe", shell: "client-portal",
    allowedModules: [...dashboard, "contrats", "sinistres"],
  },
  client_entreprise: {
    id: "client_entreprise", label: "Client Entreprise", family: "externe", shell: "client-portal",
    allowedModules: [...dashboard, "contrats", "sinistres", "compagnies"],
  },
};

export const roleList = Object.values(roles);
