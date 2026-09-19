export interface ActeMedical {
  id: string;
  libelle: string;
  famille: string;
  // Toujours le montant final applicable — saisi à la main pour un acte
  // forfaitaire, ou recalculé automatiquement (coefficient × valeur
  // unitaire de la lettre clé) dès que lettreCleCode est renseigné (voir
  // backend ActesMedicauxService.resoudrePrixCodifie).
  prixDefaut: number;
  categorieGarantie?: string;
  // Codification à la lettre clé (2026-08) — paramétrée une fois ici, sur
  // l'acte du catalogue (voir demande utilisateur : "ce sont des actes qui
  // sont paramétrés... le système remonte son coefficient"). KC entraîne
  // la génération automatique des lignes KA/K Loc liées à la saisie de
  // facture/prise en charge (voir FactureSaisie.tsx / accord-prealable).
  lettreCleCode?: string;
  coefficient?: number;
}
