// Mirrors src/auth/roles.ts RoleId on the frontend so JWT payloads and
// @Roles() guards speak the same vocabulary as the client's role picker.
export const ROLE_IDS = [
  "administrateur", "direction_generale", "directeur_technique",
  "gestionnaire_production", "gestionnaire_sinistres", "gestionnaire_sante",
  "gestionnaire_vie", "gestionnaire_flotte", "gestionnaire_entreprises",
  "comptable", "commercial", "agent_recouvrement",
  "courtier_partenaire", "compagnie_assurance", "prestataire_sante",
  "expert_auto", "expert_sinistres", "client_particulier", "client_entreprise",
] as const;

export type RoleId = (typeof ROLE_IDS)[number];
