// Tableau de bord "Pilotage Assurance" (2026-08) — voir demande
// utilisateur : "le tableau de bord ne doit pas être codé en dur mais
// interactif et réel." Miroir de backend/src/dashboard/dashboard.service.ts
// (pilotage()) — plus aucune dépendance à src/data/mock/dashboard.mock.ts.
export interface ProductionMensuelle {
  mois: string;
  prime: number;
  primeAnneePrecedente: number;
}

// Consommation mensuelle, tous contrats confondus (2026-09) — voir demande
// utilisateur : "faire remonter les données de consommation sans
// distinction de contrat dans l'application au niveau du tableau de bord".
export interface ConsommationMensuelle {
  mois: string;
  montant: number;
  montantAnneePrecedente: number;
}

export interface PortefeuilleVille {
  name: string;
  value: number; // %
  color: string;
}

export interface SinistraliteType {
  branche: string;
  "déclarés": number;
  "réglés": number;
  pendants: number;
}

export interface AlertePilotage {
  message: string;
  type: "warning" | "danger";
  view: string;
}

export interface PilotageAssurance {
  annee: number;
  anneesDisponibles: number[];
  primesEmisesCumule: number;
  primesEmisesAnneePrecedente: number;
  variationPrimesPct: number | null;
  commissionsPercues: number;
  tauxCommissionMoyen: number;
  contratsActifs: number;
  contratsARenouveler: number;
  // Actif/inactif (2026-09) — voir demande utilisateur : "il faut clairement
  // dire lesquels sont encore actifs et lesquels inactifs (terminé,
  // retiré)". contratsInactifs = contratsExpires + contratsResilies ; un
  // contrat "En renouvellement" reste en vigueur, jamais compté ici.
  contratsTotal: number;
  contratsInactifs: number;
  contratsExpires: number;
  contratsResilies: number;
  sinistresEnCours: number;
  sinistresRatioSP: number;
  clientsActifs: number;
  clientsEntreprises: number;
  // null = aucun contrat actif pour calculer un taux dessus (2026-09) —
  // jamais un défaut fabriqué (ex. 100%) qui se ferait passer pour une
  // vraie mesure sur une société sans données.
  tauxRecouvrement: number | null;
  montantImpayes: number;
  assuresSante: number;
  prisesEnChargeEnAttente: number;
  // Actif/inactif (2026-09) — même principe que contratsTotal/contratsInactifs
  // ci-dessus. assuresSanteInactifs = assuresSanteSuspendus + assuresSanteRadies.
  assuresSanteTotal: number;
  assuresSanteInactifs: number;
  assuresSanteSuspendus: number;
  assuresSanteRadies: number;
  tresorerie: number;
  productionMensuelle: ProductionMensuelle[];
  consommationMensuelle: ConsommationMensuelle[];
  consommationTotaleAnnee: number;
  portefeuilleParVille: PortefeuilleVille[];
  sinistraliteParType: SinistraliteType[];
  alertes: AlertePilotage[];
}
