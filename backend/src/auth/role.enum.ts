// Mirrors src/auth/roles.ts RoleId on the frontend so JWT payloads and
// @Roles() guards speak the same vocabulary as the client's role picker.
export const ROLE_IDS = [
  // Super Admin (2026-09) — voir demande utilisateur : "le super Admin est
  // le propriétaire de l'application... crée les sociétés d'assurances qui
  // vont utiliser l'application comme outil métier". Niveau plateforme,
  // au-dessus de toute société (User.societeId NULL) — jamais rattaché à
  // une société précise, contrairement à "administrateur" ci-dessous qui
  // reste le rôle interne le plus élevé À L'INTÉRIEUR d'une société.
  "super_admin",
  "administrateur", "direction_generale", "directeur_technique",
  "gestionnaire_production", "gestionnaire_sinistres", "gestionnaire_sante",
  "gestionnaire_entreprises",
  "comptable", "commercial", "agent_recouvrement",
  "courtier_partenaire", "compagnie_assurance", "prestataire_sante",
  "expert_sinistres", "client_particulier", "client_entreprise",
  "assure_principal", "medecin_prescripteur",
] as const;

export type RoleId = (typeof ROLE_IDS)[number];
