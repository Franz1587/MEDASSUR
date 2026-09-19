// Journal des opérations (2026-08) — trace toute mutation (créer/modifier/
// clôturer) sur l'API, jamais une simple consultation (voir demande
// utilisateur : "ne pas confondre avec le fait d'ouvrir une facture").
export interface AuditLogEntry {
  id: string;
  entite: string;
  entiteId: string;
  action: string; // Créé | Modifié | Clôturé
  utilisateur: string; // email
  utilisateurNom: string;
  dateAction: string; // ISO
  details?: string;
}

export type DerniereModification = AuditLogEntry;

// Capacité de traitement par agent (2026-08) — nombre de factures et de
// règlements établis (voir demande utilisateur).
export interface StatAgent {
  utilisateur: string;
  nom: string;
  factures: number;
  reglements: number;
  total: number;
}
