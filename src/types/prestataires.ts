export interface GrilleTarifaire {
  acte: string;
  plafond: number;
}

export interface Prestataire {
  id: string;
  nom: string;
  type: string;
  // Détermine le taux de Contrat appliqué lors du calcul d'une prise en
  // charge (voir PriseEnChargeService côté backend) — distinct de `type`.
  secteur?: "Public" | "Privé" | null;
  // Titre — vestige d'un ancien type = "Médecin" retiré (2026-08, voir
  // src/features/medecins) ; jamais renseigné par le formulaire actuel.
  titre?: "Professeur" | "Docteur" | null;
  specialite?: string | null;
  pays: string;
  ville: string;
  telephone?: string | null;
  adresse?: string | null;
  statutConvention: string;
  dateConventionnement?: string;
  delaiPaiementMoyen?: number;
  scoreQualite?: number;
  motifSuspension?: string;
  // Réseau de soins (2026-08) — géolocalisation (voir PrestatairesService.geolocaliser).
  latitude?: number | null;
  longitude?: number | null;
  // TPS (2026-08) — 9,5% de la base de remboursement, prélevée
  // uniquement sur la fenêtre [tpsDateEffet, tpsDateArret] (arrêt
  // optionnel = toujours actif une fois la date d'effet passée).
  tpsAssujetti: boolean;
  tpsDateEffet?: string | null;
  tpsDateArret?: string | null;
  grillesTarifaires: GrilleTarifaire[];
  // Visibilité du portail prestataire (2026-08) — voir demande utilisateur :
  // "définir les garanties/actes qui doivent s'afficher en fonction du type
  // de prestataire". Vide = aucune restriction.
  garantiesVisibles: string[];
  categoriesActesVisibles: string[];
}
