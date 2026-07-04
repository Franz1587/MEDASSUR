import type { RoleId } from "@/auth/roles";

export type RoleFamily = "direction" | "production" | "sinistres_sante" | "finance" | "commercial";

/**
 * Groups the 12 internal roles into 5 dashboard families. External roles
 * (courtier_partenaire, compagnie_assurance, prestataire_sante, expert_*,
 * client_*) are intentionally absent — they use PortalShell, not the ERP
 * dashboard, and RoleDashboard falls back to the generic DashboardView
 * for any role missing here.
 */
export const roleFamilies: Partial<Record<RoleId, RoleFamily>> = {
  administrateur: "direction",
  direction_generale: "direction",
  directeur_technique: "direction",

  gestionnaire_production: "production",
  gestionnaire_entreprises: "production",
  gestionnaire_vie: "production",
  gestionnaire_flotte: "production",

  gestionnaire_sinistres: "sinistres_sante",
  gestionnaire_sante: "sinistres_sante",

  comptable: "finance",
  agent_recouvrement: "finance",

  commercial: "commercial",
};
