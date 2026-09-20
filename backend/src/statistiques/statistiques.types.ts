// Types du rapport Statistiques (2026-08) — voir demande utilisateur :
// rapport calqué sur "Modèle statistiques.pdf", recalculé en direct à
// chaque génération (rien n'est persisté). Partagé entre StatistiquesService
// (calcul), StatistiquesController (JSON, vue en ligne) et
// DocumentsService.renderStatistiques (PDF/Word).

export interface AnalyseSection {
  titre: string;
  lignes: string[];
}

export interface AnalyseNarrative {
  sections: AnalyseSection[];
  conclusionGenerale: string[];
  // `titre` (2026-09) — "Projection" pour un exercice en cours,
  // "Résultat de l'exercice" pour un exercice déjà clôturé (voir
  // genererAnalyseNarrative/periodeCloturee) : le contenu ne parle plus de
  // projection dans ce second cas, le titre ne doit pas non plus.
  projection: { titre: string; spProjeteMin: number; spProjeteMax: number; montantAnnuelEstime: number; lignes: string[] };
  conclusionStrategique: string[];
  conclusionFinale: string[];
}

export interface EvolutionMensuelleLigne {
  label: string;
  montant: number;
}

export interface ConsommationLigne {
  matricule: string;
  famille: string;
  montant: number;
}

export interface RepartitionSousGroupe {
  nombre: number;
  montant: number;
  pctDepenses: number;
  pctPopulation: number;
}

export interface RepartitionBeneficiaireLigne {
  type: "Assurés Principaux" | "Conjoints" | "Enfants";
  nombre: number;
  montant: number;
  pctDepenses: number;
  pctPopulation: number;
  feminin: RepartitionSousGroupe;
  masculin: RepartitionSousGroupe;
}

export interface RepartitionLigne {
  libelle: string;
  montant: number;
  // Nombre d'actes réalisés dans la rubrique/famille (2026-09) — voir
  // demande utilisateur : "ajoute... une colonne Nombre Actes avant celle
  // du taux afin que l'on puisse évaluer exactement le nombre d'actes
  // réalisé dans la rubrique."
  nombre: number;
  pct: number;
}

export interface SpBloc {
  sinistres: number;
  primes: number;
  ratioPct: number;
  tranche: string;
  regularisationPct: number;
}

// Rubrique additionnelle, hors modèle de référence (voir demande
// utilisateur : "je veux que tu ajoutes une rubrique qui n'existe pas dans
// le modèle... le détail de statistique par famille... précisément qui a
// consommé et pour quel acte... à quelle date") — descend chaque famille
// jusqu'au niveau ligne (assuré, date de soin, acte, montant), cohérent
// avec la mémoire "Facture égale détails".
export interface DetailFamilleLigne {
  assureNom: string;
  date: string;
  acte: string;
  montant: number;
}

export interface DetailFamille {
  matricule: string;
  famille: string;
  totalFamille: number;
  lignes: DetailFamilleLigne[];
}

// Même principe que DetailFamille, groupé par prestataire cette fois — voir
// demande utilisateur : nouvelle rubrique "Détails de prestations Par
// prestataires".
export interface DetailPrestataireLigne {
  assureNom: string;
  date: string;
  acte: string;
  montant: number;
}

export interface DetailPrestataire {
  prestataire: string;
  totalPrestataire: number;
  lignes: DetailPrestataireLigne[];
}

// Regroupement par ANNÉE, à côté du regroupement mensuel — voir demande
// utilisateur : "analyse statistique sur plusieurs années".
export interface EvolutionAnnuelleLigne {
  label: string;
  montant: number;
}

// Identifiants des rubriques sélectionnables pour un export "à la carte"
// (voir demande utilisateur : "l'application doit permettre de sélectionner
// [cocher] les rubriques que l'on veut voir apparaître sur le fichier à
// télécharger") — partagés entre DocumentsService (filtre de rendu) et le
// frontend (liste de cases à cocher), pour ne jamais désynchroniser les
// deux listes.
export const RUBRIQUES_STATISTIQUES = [
  "basesContractuelles", "evolutionMensuelle", "consommationParFamille", "detailParFamille",
  "top20Consommateurs", "repartitionBeneficiaire", "consommationParRubrique", "consommationParFamilleActe",
  "consommationParPrestataire", "detailParPrestataire", "top20Prestataires",
  "evolutionSP", "analyse",
] as const;
export type RubriqueId = (typeof RUBRIQUES_STATISTIQUES)[number];

export interface StatistiquesPayload {
  contrat: {
    id: string;
    numeroPolice: string;
    client: string;
    compagnie: string;
    branche: string;
    garantiesPrivees: string;
  };
  periode: { du: string; au: string };
  basesContractuelles: { college: string; assureur: string; policeNumero: string; dateEffet: string };
  evolutionMensuelle: EvolutionMensuelleLigne[];
  evolutionAnnuelle: EvolutionAnnuelleLigne[];
  totalConsomme: number;
  consommationParFamille: ConsommationLigne[];
  detailParFamille: DetailFamille[];
  top20Consommateurs: ConsommationLigne[];
  repartitionBeneficiaire: RepartitionBeneficiaireLigne[];
  totalPersonnesSoignees: number;
  consommationParRubrique: RepartitionLigne[];
  // Consommation par FAMILLE D'ACTES (2026-09) — voir demande utilisateur :
  // "il faut ajouter dans les statistiques une rubrique appelée
  // consommation par famille des actes (exemple acte ORL, actes du
  // cardiologue, échographie...)" — distincte de consommationParRubrique
  // (ActeMedical.categorieGarantie, 13 rubriques du tableau de garanties) :
  // ici c'est ActeMedical.famille, le regroupement plus fin du catalogue.
  consommationParFamilleActe: RepartitionLigne[];
  consommationParPrestataire: RepartitionLigne[];
  detailParPrestataire: DetailPrestataire[];
  top20Prestataires: RepartitionLigne[];
  spSansChargement: SpBloc;
  spAvecChargement: SpBloc;
  analyse: AnalyseNarrative;
}
