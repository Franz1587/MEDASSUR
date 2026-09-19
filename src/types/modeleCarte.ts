// Catalogue des modèles de carte importables (2026-09) — voir demande
// utilisateur : "on peut importer les modèles et l'application place le
// modèle comme choix pour chaque société." Catalogue PARTAGÉ, géré par le
// Super Admin ; chaque société choisit ensuite parmi ce catalogue (voir
// ParametresEntreprise.modeleCarteId).
export interface ModeleCarte {
  id: string;
  nom: string;
  description?: string | null;
  imageRecto?: string | null;
  imageVerso?: string | null;
  actif: boolean;
  createdAt: string;
}

export interface CreerModeleCarteInput {
  nom: string;
  description?: string;
}

export interface ModifierModeleCarteInput {
  nom?: string;
  description?: string;
  actif?: boolean;
}
