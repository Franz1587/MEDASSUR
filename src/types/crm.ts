export interface Prospect {
  id: string;
  nom: string;
  type: string;
  source: string;
  etape: string;
  valeurEstimee: number;
  commercial: string;
  dernierContact: string;
  gestionnaireId: string | null;
  // Nom de fichier sous backend/uploads/logos-prospects/ — voir
  // uploadProspectLogo(). Affiché sur le document de cotation à la place du
  // nom du client quand il est renseigné.
  logo: string | null;
  createdAt: string;

  // Personne ressource (2026-08) — l'interlocuteur côté prospect, distinct
  // de `commercial` (l'agent MedAssur en charge du dossier).
  contactNom?: string;
  contactFonction?: string;
  contactTelephone?: string;
  contactEmail?: string;

  // Type de contrat envisagé (2026-08).
  typeContrat?: "MaladieEtAssistance" | "MaladieSeule";

  // Conversion en client (2026-08) — voir CrmService.lierClient.
  clientId?: string;
  clientNom?: string;
}

export interface ProspectHistoriqueEntry {
  id: string;
  date: string;
  auteurNom?: string;
  type: "ChangementEtape" | "Note";
  etapeAvant?: string;
  etapeApres?: string;
  description: string;
}

export interface ProspectDetail extends Prospect {
  historique: ProspectHistoriqueEntry[];
}

export interface SuggestionCommission {
  compagnieId: string;
  compagnieNom: string;
  compagnieLogo: string | null;
  tauxCommissionMaladie: number | null;
  tauxCommissionAssistance: number | null;
  montantCommissionEstime: number;
}

export interface SuggestionsCommissionProspect {
  valeurEstimee: number;
  typeContrat?: string;
  suggestions: SuggestionCommission[];
  meilleureCompagnie: SuggestionCommission | null;
  // Moyenne toutes compagnies confondues (2026-08) — voir demande
  // utilisateur : "en moyenne la commission que cela devrait rapporter".
  commissionMoyenneEstimee: number;
}

export interface StatistiquesProspection {
  exercice: number;
  prospectsCrees: number;
  gagnes: {
    total: number;
    valeurTotale: number;
    convertisEnClient: number;
    liste: { prospectId: string; nom: string; valeurEstimee: number; date: string; convertiEnClient: boolean }[];
  };
  perdus: {
    total: number;
    valeurTotale: number;
    liste: { prospectId: string; nom: string; valeurEstimee: number; date: string }[];
  };
  tauxTransformation: number;
  parCommercial: { commercial: string; crees: number; gagnes: number; perdus: number }[];
}
