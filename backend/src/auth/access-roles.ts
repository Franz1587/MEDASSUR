import type { RoleId } from "./role.enum";

// Groupes de rôles internes réutilisés par @Roles(...) dans les contrôleurs.
// Dérivés de src/auth/roles.ts (allowedModules par rôle) : on liste les rôles
// qui possèdent l'écran correspondant, plus administrateur/direction_generale
// (accès à toutes les vues). Voir backend/ACCESS-MATRIX.md.

export const ROLES_DIRECTION: RoleId[] = ["administrateur", "direction_generale"];

/** Prises en charge, accords, actes, médecins, lettres clés, journal/suivi agents, fraude, GED. */
export const ROLES_SANTE: RoleId[] = [
  "administrateur", "direction_generale", "directeur_technique",
  "gestionnaire_sinistres", "gestionnaire_sante",
];

/** Contrats, avenants, renouvellements, résiliations, participants, catalogue de garanties. */
export const ROLES_PRODUCTION: RoleId[] = [
  "administrateur", "direction_generale", "directeur_technique",
  "gestionnaire_production", "gestionnaire_sante",
];

/** Clients / compagnies : production + gestionnaire entreprises + commercial. */
export const ROLES_CLIENTS: RoleId[] = [
  "administrateur", "direction_generale", "directeur_technique",
  "gestionnaire_production", "gestionnaire_sante", "gestionnaire_entreprises", "commercial",
];

/** Appels d'offres / cotation / CRM. */
export const ROLES_COMMERCIAL: RoleId[] = [
  "administrateur", "direction_generale",
  "gestionnaire_production", "gestionnaire_entreprises", "commercial",
];

/** Comptabilité, trésorerie, fonds de roulement, honoraires, commissions. */
export const ROLES_FINANCE: RoleId[] = ["administrateur", "direction_generale", "comptable"];

/** Banques, agences, bordereaux, encaissements. */
export const ROLES_BANQUES: RoleId[] = [
  "administrateur", "direction_generale", "directeur_technique", "comptable",
];

/** Règlements prestataires/comptables, lettrage. */
export const ROLES_REGLEMENT: RoleId[] = [
  "administrateur", "direction_generale", "directeur_technique",
  "gestionnaire_sante", "comptable",
];

/** Recouvrement. */
export const ROLES_RECOUVREMENT: RoleId[] = [
  "administrateur", "direction_generale", "comptable", "agent_recouvrement",
];

/** Réseau de prestataires (écriture) et professionnels de santé. */
export const ROLES_PRESTATAIRES: RoleId[] = [
  "administrateur", "direction_generale", "directeur_technique", "gestionnaire_sante",
];

/** Import de données : administrateurs, production et santé. */
export const ROLES_IMPORT: RoleId[] = [
  "administrateur", "direction_generale", "directeur_technique",
  "gestionnaire_production", "gestionnaire_sinistres", "gestionnaire_sante",
];
