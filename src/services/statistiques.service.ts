import { http } from "@/lib/http";

// Miroir de backend/src/statistiques/statistiques.types.ts — payload
// recalculé en direct à chaque appel (rien n'est persisté), voir demande
// utilisateur : "selon les données à la minute même où la statistique est
// générée".
export interface AnalyseSection {
  titre: string;
  lignes: string[];
}

export interface AnalyseNarrative {
  sections: AnalyseSection[];
  conclusionGenerale: string[];
  projection: { spProjeteMin: number; spProjeteMax: number; montantAnnuelEstime: number; lignes: string[] };
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
  pct: number;
}

export interface SpBloc {
  sinistres: number;
  primes: number;
  ratioPct: number;
  tranche: string;
  regularisationPct: number;
}

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

// Même principe que DetailFamille, groupé par prestataire — voir demande
// utilisateur : nouvelle rubrique "Détails de prestations Par prestataires".
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

export interface EvolutionAnnuelleLigne {
  label: string;
  montant: number;
}

export interface StatistiquesPayload {
  contrat: { id: string; numeroPolice: string; client: string; compagnie: string; branche: string; garantiesPrivees: string };
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
  consommationParPrestataire: RepartitionLigne[];
  detailParPrestataire: DetailPrestataire[];
  top20Prestataires: RepartitionLigne[];
  spSansChargement: SpBloc;
  spAvecChargement: SpBloc;
  analyse: AnalyseNarrative;
}

// Rubriques sélectionnables pour l'export "à la carte" (voir demande
// utilisateur : "cocher les rubriques que l'on veut voir apparaître sur le
// fichier à télécharger") — mêmes identifiants que
// backend/src/statistiques/statistiques.types.ts RUBRIQUES_STATISTIQUES,
// jamais désynchronisés puisque le backend ignore silencieusement tout id
// inconnu et inclut la rubrique par défaut si l'id attendu manque à
// l'appel (voir DocumentsService.renderStatistiques, `inclut`).
export const RUBRIQUES_STATISTIQUES: { id: string; label: string }[] = [
  { id: "basesContractuelles", label: "Bases Contractuelles" },
  { id: "evolutionMensuelle", label: "Évolution des consommations par mois" },
  { id: "consommationParFamille", label: "Consommation par famille" },
  { id: "detailParFamille", label: "Détails de Consommation Par Famille" },
  { id: "top20Consommateurs", label: "Top 20 des consommateurs" },
  { id: "repartitionBeneficiaire", label: "Répartition par type de bénéficiaire" },
  { id: "consommationParRubrique", label: "Consommation par Rubrique" },
  { id: "consommationParPrestataire", label: "Consommation par Prestataire" },
  { id: "detailParPrestataire", label: "Détails de Prestations Par Prestataires" },
  { id: "top20Prestataires", label: "Top 20 des prestataires" },
  { id: "evolutionSP", label: "Evolution du S/P" },
  { id: "analyse", label: "Analyse des données statistiques" },
];

export async function getStatistiques(contratId: string, du?: string, au?: string): Promise<StatistiquesPayload> {
  const params = new URLSearchParams();
  if (du) params.set("du", du);
  if (au) params.set("au", au);
  const qs = params.toString();
  return http.get<StatistiquesPayload>(`/statistiques/${contratId}${qs ? `?${qs}` : ""}`);
}
