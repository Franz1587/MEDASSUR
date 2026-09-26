import { http, downloadFile, uploadFile } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import { mapAvenant } from "@/services/avenants.service";
import type { Contrat } from "@/types/contrats";
import type { Avenant } from "@/types/avenants";
import type { AssureSante } from "@/types/sante";

export interface ApiContrat {
  id: string;
  branche: string;
  dateDebut: string;
  dateFin: string;
  prime: string | number;
  statut: string;
  numeroPolice?: string | null;
  nomCarteSante?: string | null;
  client: { id: string; nom: string };
  compagnie: { nom: string };
  agenceId?: string | null;
  agence?: { nom: string } | null;
  paysSouscription?: string | null;
  extensionsTerritorialite?: string[];
  contratMaladieLieId?: string | null;
  tauxCouvertureAmbulatoire?: string | null;
  tauxCouvertureHospitalisation?: string | null;
  tauxAmbulatoirePublique?: string | null;
  tauxAmbulatoirePrivee?: string | null;
  tauxHospitalisationPublique?: string | null;
  tauxHospitalisationPrivee?: string | null;
  tauxAmbulatoirePubliqueAyantDroit?: string | null;
  tauxAmbulatoirePriveeAyantDroit?: string | null;
  tauxHospitalisationPubliqueAyantDroit?: string | null;
  tauxHospitalisationPriveeAyantDroit?: string | null;
  nombreAssuresPrincipaux?: number | null;
  primeUnitaireAssurePrincipal?: string | number | null;
  nombreConjoints?: number | null;
  primeUnitaireConjoint?: string | number | null;
  nombreEnfants?: number | null;
  primeUnitaireEnfant?: string | number | null;
  nombreCouples?: number | null;
  primeUnitaireCouple?: string | number | null;
  tauxTerritorialite?: string | number | null;
  limiteAgeAdulte?: number | null;
  limiteAgeEnfant?: number | null;
  limiteAgeEnfantScolarise?: number | null;
  limitePersFamille?: number | null;
  plafondAdherent?: string | number | null;
  plafondFamille?: string | number | null;
  plafondPolice?: string | number | null;
  tauxMinoMajoration?: string | number | null;
  tauxReductionCommerciale?: string | number | null;
  montantAccessoires?: string | number | null;
  tauxCommission?: string | number | null;
  montantCommission?: string | number | null;
  primeNette?: string | number | null;
  primeTotaleHT?: string | number | null;
  montantTaxe?: string | number | null;
  periodicite?: string;
  typeAffaire?: string;
  exerciceNumero?: number;
  produit?: string | null;
  saisieApresResiliationAutorisee?: boolean;
  garanties?: ApiGarantie[];
}

interface ApiGarantie {
  id: string;
  categorie: string;
  libelle: string;
  tauxAssure: string | number | null;
  tauxAyantsDroit: string | number | null;
  plafond: string | null;
  plafondMontant?: string | number | null;
  plafondPeriode?: string | null;
}

function n(v: string | number | null | undefined): number | null {
  return v === null || v === undefined ? null : toNumber(v);
}

// Jours restants avant l'échéance (2026-09) — voir demande utilisateur,
// capture annotée de la liste Contrats : "faire remonter la dernière
// échéance du contrat qu'il soit résilié ou actif." La colonne "Échéance"
// utilisait auparavant `GET /renouvellements`, qui ne liste QUE les
// contrats ayant déjà un avenant de type Renouvellement (un contrat neuf,
// jamais encore renouvelé, en était donc absent — colonne vide/"—" alors
// qu'il a bien une date d'échéance). Calculé ici directement depuis
// `dateFin`, pour TOUT contrat quel que soit son statut — même logique
// que RenouvellementsService.joursRestants côté backend (JJ/MM/AAAA,
// arrondi en jours calendaires depuis aujourd'hui 00:00).
export function joursRestants(dateFinFr: string): number {
  const [d, m, y] = dateFinFr.split("/").map(Number);
  if (!d || !m || !y) return NaN;
  const cible = new Date(y, m - 1, d);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((cible.getTime() - aujourdhui.getTime()) / (1000 * 60 * 60 * 24));
}

// Exporté pour réutilisation par le portail client (voir
// src/services/portailClient.service.ts) — même forme de réponse API.
export function mapContrat(c: ApiContrat): Contrat {
  const jr = joursRestants(c.dateFin);
  return {
    id: c.id,
    clientId: c.client.id,
    client: c.client.nom,
    branche: c.branche,
    compagnie: c.compagnie.nom,
    dateDebut: c.dateDebut,
    dateFin: c.dateFin,
    prime: toNumber(c.prime),
    statut: c.statut,
    numeroPolice: c.numeroPolice ?? null,
    nomCarteSante: c.nomCarteSante ?? null,
    jours: Number.isNaN(jr) ? "—" : jr < 0 ? "Échu" : `${jr} jours`,
    paysSouscription: c.paysSouscription ?? "",
    extensionsTerritorialite: c.extensionsTerritorialite ?? [],
    contratMaladieLieId: c.contratMaladieLieId ?? null,
    agenceId: c.agenceId ?? null,
    tauxCouvertureAmbulatoire: c.tauxCouvertureAmbulatoire ?? null,
    tauxCouvertureHospitalisation: c.tauxCouvertureHospitalisation ?? null,
    tauxAmbulatoirePublique: c.tauxAmbulatoirePublique ?? null,
    tauxAmbulatoirePrivee: c.tauxAmbulatoirePrivee ?? null,
    tauxHospitalisationPublique: c.tauxHospitalisationPublique ?? null,
    tauxHospitalisationPrivee: c.tauxHospitalisationPrivee ?? null,
    tauxAmbulatoirePubliqueAyantDroit: c.tauxAmbulatoirePubliqueAyantDroit ?? null,
    tauxAmbulatoirePriveeAyantDroit: c.tauxAmbulatoirePriveeAyantDroit ?? null,
    tauxHospitalisationPubliqueAyantDroit: c.tauxHospitalisationPubliqueAyantDroit ?? null,
    tauxHospitalisationPriveeAyantDroit: c.tauxHospitalisationPriveeAyantDroit ?? null,
    nombreAssuresPrincipaux: c.nombreAssuresPrincipaux ?? null,
    primeUnitaireAssurePrincipal: n(c.primeUnitaireAssurePrincipal),
    nombreConjoints: c.nombreConjoints ?? null,
    primeUnitaireConjoint: n(c.primeUnitaireConjoint),
    nombreEnfants: c.nombreEnfants ?? null,
    primeUnitaireEnfant: n(c.primeUnitaireEnfant),
    nombreCouples: c.nombreCouples ?? null,
    primeUnitaireCouple: n(c.primeUnitaireCouple),
    tauxTerritorialite: n(c.tauxTerritorialite),
    limiteAgeAdulte: c.limiteAgeAdulte ?? null,
    limiteAgeEnfant: c.limiteAgeEnfant ?? null,
    limiteAgeEnfantScolarise: c.limiteAgeEnfantScolarise ?? null,
    limitePersFamille: c.limitePersFamille ?? null,
    plafondAdherent: n(c.plafondAdherent),
    plafondFamille: n(c.plafondFamille),
    plafondPolice: n(c.plafondPolice),
    tauxMinoMajoration: n(c.tauxMinoMajoration),
    tauxReductionCommerciale: n(c.tauxReductionCommerciale),
    montantAccessoires: n(c.montantAccessoires),
    tauxCommission: n(c.tauxCommission),
    montantCommission: n(c.montantCommission),
    primeNette: n(c.primeNette),
    primeTotaleHT: n(c.primeTotaleHT),
    montantTaxe: n(c.montantTaxe),
    periodicite: c.periodicite ?? null,
    typeAffaire: c.typeAffaire ?? null,
    exerciceNumero: c.exerciceNumero ?? null,
    produit: c.produit ?? null,
    saisieApresResiliationAutorisee: c.saisieApresResiliationAutorisee ?? false,
    garanties: (c.garanties ?? []).map((g) => ({
      id: g.id, categorie: g.categorie, libelle: g.libelle,
      tauxAssure: n(g.tauxAssure), tauxAyantsDroit: n(g.tauxAyantsDroit), plafond: g.plafond,
      plafondMontant: n(g.plafondMontant), plafondPeriode: g.plafondPeriode ?? null,
    })),
  };
}

export async function getContrats(compagnieId?: string): Promise<Contrat[]> {
  const contrats = await http.get<ApiContrat[]>(compagnieId ? `/contrats?compagnieId=${encodeURIComponent(compagnieId)}` : "/contrats");
  return contrats.map((c) => mapContrat(c));
}

export interface ContratUpsertInput {
  clientId: string;
  compagnieId: string;
  branche: "Maladie" | "Assistance";
  dateDebut: string;
  dateFin: string;
  prime: number;
  statut: "Actif" | "En renouvellement" | "Expiré" | "Résilié";
  numeroPolice?: string;
  nomCarteSante?: string;
  agenceId?: string;
  periodicite?: "Mensuel" | "Trimestriel" | "Semestriel" | "Annuel";
  paysSouscription?: string;
  extensionsTerritorialite?: string[];
  contratMaladieLieId?: string;
  tauxCouvertureAmbulatoire?: string;
  tauxCouvertureHospitalisation?: string;
  tauxAmbulatoirePublique?: string;
  tauxAmbulatoirePrivee?: string;
  tauxHospitalisationPublique?: string;
  tauxHospitalisationPrivee?: string;
  tauxAmbulatoirePubliqueAyantDroit?: string;
  tauxAmbulatoirePriveeAyantDroit?: string;
  tauxHospitalisationPubliqueAyantDroit?: string;
  tauxHospitalisationPriveeAyantDroit?: string;
  nombreAssuresPrincipaux?: number;
  primeUnitaireAssurePrincipal?: number;
  nombreConjoints?: number;
  primeUnitaireConjoint?: number;
  nombreEnfants?: number;
  primeUnitaireEnfant?: number;
  nombreCouples?: number;
  primeUnitaireCouple?: number;
  tauxTerritorialite?: number;
  limiteAgeAdulte?: number;
  limiteAgeEnfant?: number;
  limiteAgeEnfantScolarise?: number;
  limitePersFamille?: number;
  plafondAdherent?: number;
  plafondFamille?: number;
  plafondPolice?: number;
  tauxMinoMajoration?: number;
  tauxReductionCommerciale?: number;
  montantAccessoires?: number;
  tauxCommission?: number;
  produit?: string;
}

// Imputation compagnie ↔ agence (2026-09) — renvoyée par le backend à la
// création/modification (voir ContratsService.imputerSelonAgence) : le
// contrat a pu être imputé à la déclinaison d'agence de sa compagnie
// (ex. "NSIA ASSURANCES POG"), ou un avertissement signale qu'aucune
// déclinaison n'était possible.
export interface ImputationAgence {
  imputation?: { de: string; vers: string; creee: boolean };
  avertissement?: string;
}

export async function createContrat(payload: ContratUpsertInput): Promise<Contrat & { imputationAgence?: ImputationAgence }> {
  const c = await http.post<ApiContrat & { imputationAgence?: ImputationAgence }>("/contrats", payload);
  return { ...mapContrat(c), imputationAgence: c.imputationAgence };
}

export async function updateContrat(id: string, payload: Partial<ContratUpsertInput>): Promise<Contrat & { imputationAgence?: ImputationAgence }> {
  const c = await http.patch<ApiContrat & { imputationAgence?: ImputationAgence }>(`/contrats/${id}`, payload);
  return { ...mapContrat(c), imputationAgence: c.imputationAgence };
}

export async function deleteContrat(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/contrats/${id}`);
}

// Dérogation de saisie post-résiliation (2026-09) — voir demande
// utilisateur, bouton "Permettre la saisie des prestations et des prises
// en charge après la date de résiliation ou fermeture des droits."
export async function toggleDerogationSaisie(id: string, autoriser: boolean): Promise<Contrat> {
  const c = await http.patch<ApiContrat>(`/contrats/${id}/derogation-saisie`, { autoriser });
  return mapContrat(c);
}

// Numéro de police (2026-08) — suggestion auto-calculée (dernier numéro
// déjà utilisé pour cette compagnie + 1, ou son code + 1 si aucun contrat)
// affichée dès qu'une compagnie est choisie, mais reste éditable au champ
// (reprise d'antériorité) — voir ContratsService.prochainNumeroPolice.
export async function getProchainNumeroPolice(compagnieId: string): Promise<string> {
  const data = await http.get<{ numeroPolice: string }>(`/contrats/prochain-numero-police?compagnieId=${encodeURIComponent(compagnieId)}`);
  return data.numeroPolice;
}

// Import en masse (2026-08) — reprise d'antériorité (voir demande
// utilisateur). Champs minimaux — le détail (population, garanties) se
// complète au cas par cas après import, via l'écran habituel.
export interface ImportContratRow {
  souscripteur: string; compagnie: string;
  branche?: string; dateDebut?: string; dateFin?: string; prime?: string; statut?: string; periodicite?: string; numeroPolice?: string; agence?: string;
}

export function telechargerModeleImportContrats(): Promise<void> {
  return downloadFile("/contrats/modele-import", "modele-import-contrats.xlsx");
}

export function apercuImportContrats(file: File): Promise<{ lignes: ImportContratRow[]; rejets: { ligne: number; motif: string }[] }> {
  return uploadFile(`/contrats/import/apercu`, file);
}

export function confirmerImportContrats(rows: ImportContratRow[]): Promise<{ crees: number; rejets: { ligne: number; motif: string }[] }> {
  return http.post(`/contrats/import`, { rows });
}

export interface GarantieInput {
  categorie: string;
  libelle: string;
  tauxAssure?: number;
  tauxAyantsDroit?: number;
  plafond?: string;
  plafondMontant?: number;
  plafondPeriode?: string;
}

export async function replaceGaranties(contratId: string, garanties: GarantieInput[]): Promise<Contrat> {
  const c = await http.patch<ApiContrat>(`/contrats/${contratId}/garanties`, { garanties });
  return mapContrat(c);
}

export interface AjoutPersonneInput {
  nom: string;
  prenom?: string;
  matricule?: string;
  dateNaissance?: string;
  typeAssure?: string;
  // Enfant (EF) encore scolarisé — voir types/sante.ts.
  scolarise?: boolean;
  beneficiaires: number;
  cotisation: number;
}

interface ApiMouvementPopulationResult {
  contrat: ApiContrat;
  avenants: Array<{
    id: string; contratId: string; type: string; description: string;
    primeAvant: string | number; primeApres: string | number; dateEffet: string; statut: string;
    contrat: { client: { nom: string } };
  }>;
}

export async function mouvementPopulation(
  contratId: string,
  payload: { ajouts?: AjoutPersonneInput[]; retraitIds?: string[]; dateEffet: string },
): Promise<{ contrat: Contrat; avenants: Avenant[] }> {
  const res = await http.post<ApiMouvementPopulationResult>(`/contrats/${contratId}/mouvement-population`, payload);
  return { contrat: mapContrat(res.contrat), avenants: res.avenants.map(mapAvenant) };
}

// Bascule de tout ou partie de la population d'un contrat vers un autre en
// une seule opération (2026-08) — cas typique : contrat résilié dont la
// population, jamais radiée automatiquement, est reprise des années plus
// tard par un nouveau contrat, même souscripteur ou un autre. Voir
// MouvementsService.basculerPopulationVersContrat côté backend, qui
// complète automatiquement toute famille sélectionnée partiellement.
export async function basculerPopulation(
  contratSourceId: string,
  payload: { contratDestinationId: string; assureIds: string[]; dateEffet: string },
): Promise<{ basculees: string[] }> {
  return http.post<{ basculees: string[] }>(`/contrats/${contratSourceId}/basculer-population`, payload);
}

// Historique des Exercices du contrat (2026-08) — un exercice est une
// période de 12 mois AU PLUS (peut être plus court, et à cheval sur deux
// années civiles) délimitée par dateDebut/dateFin — une ligne à la
// souscription, une nouvelle à chaque Renouvellement, et un import dont
// l'intervalle dépasse 12 mois en crée plusieurs d'emblée (voir
// ContratsService.decouperEnExercices). `compagnie` ne porte une valeur
// que lors d'un avenant "Changement de Compagnie" (sinon la compagnie du
// contrat reste inchangée sur toute la durée) — voir Exercice.compagnieId.
export interface ExerciceCompagnie {
  id: string;
  numero: number;
  dateDebut: string;
  dateFin: string;
  prime: string | number;
  statut: string;
  compagnie: { id: string; nom: string } | null;
  // Prime détaillée par personne (2026-09) — voir demande utilisateur :
  // reprise de données, saisir la prime d'une ancienne période pour
  // rendre le calcul du S/P possible sur cette période. Voir
  // ContratsService.mettreAJourPrimeExercice.
  nombreAssuresPrincipaux?: number | null;
  primeUnitaireAssurePrincipal?: string | number | null;
  nombreConjoints?: number | null;
  primeUnitaireConjoint?: string | number | null;
  nombreEnfants?: number | null;
  primeUnitaireEnfant?: string | number | null;
  nombreCouples?: number | null;
  primeUnitaireCouple?: string | number | null;
  tauxMinoMajoration?: string | number | null;
  tauxReductionCommerciale?: string | number | null;
  montantAccessoires?: string | number | null;
  tauxCommission?: string | number | null;
  montantCommission?: string | number | null;
  montantTaxe?: string | number | null;
  primeNette?: string | number | null;
  primeTotaleHT?: string | number | null;
}

export async function getHistoriqueCompagnie(contratId: string): Promise<ExerciceCompagnie[]> {
  return http.get<ExerciceCompagnie[]>(`/contrats/${contratId}/historique-compagnie`);
}

// Correction manuelle d'un exercice (2026-08) — voir demande utilisateur :
// "il peut arriver que les données de l'import de date d'un exercice ne
// soit pas correct, on doit pouvoir aller modifier pour que l'application
// fasse un récalibrage au niveau des échéances et des dates d'effet."
// Renvoie l'historique COMPLET recalculé (exercices suivants recalibrés
// en cascade côté serveur, voir ContratsService.recalibrerExercice).
export async function recalibrerExercice(
  contratId: string, numero: number, dto: { dateDebut: string; dateFin: string },
): Promise<ExerciceCompagnie[]> {
  return http.patch<ExerciceCompagnie[]>(`/contrats/${contratId}/exercices/${numero}`, dto);
}

// Prime détaillée d'un exercice passé (2026-09) — voir demande
// utilisateur : "on puisse renseigner la prime par personne et les
// accessoires et l'outil calculera la prime nette totale qui sera
// utilisée pour le calcul du S/P." Renvoie l'historique complet (même
// forme que recalibrerExercice) avec la primeNette recalculée.
export interface ExercicePrimeInput {
  nombreAssuresPrincipaux?: number; primeUnitaireAssurePrincipal?: number;
  nombreConjoints?: number; primeUnitaireConjoint?: number;
  nombreEnfants?: number; primeUnitaireEnfant?: number;
  nombreCouples?: number; primeUnitaireCouple?: number;
  tauxMinoMajoration?: number; tauxReductionCommerciale?: number;
  montantAccessoires?: number; tauxCommission?: number;
}

export async function mettreAJourPrimeExercice(
  contratId: string, numero: number, dto: ExercicePrimeInput,
): Promise<ExerciceCompagnie[]> {
  return http.patch<ExerciceCompagnie[]>(`/contrats/${contratId}/exercices/${numero}/prime`, dto);
}

interface ApiPersonnePeriode {
  id: string;
  nom: string;
  prenom: string | null;
  matricule: string;
  typeAssure: string | null;
  familleId: string | null;
  dateNaissance: string | null;
  sexe: string | null;
  cotisation: string;
  scolarise: boolean;
  statutActuel: string;
  statutPeriode: "Actif" | "Suspendu" | "Radié";
}

// Population reconstituée sur une période passée (du/au optionnels — sans
// eux, la population actuelle) + filtre statut — voir l'onglet Population
// de la fiche contrat (bouton "Rechercher" à côté des filtres) et
// backend reconstituerPopulation, réutilisée telle quelle par les exports
// PDF/Excel/Word. Retourne des objets compatibles AssureSante pour que
// PopulationPanel puisse réutiliser exactement le même rendu de ligne.
export async function getPopulationHistorique(
  contratId: string,
  filtre: { statut?: "tous" | "Actif" | "Radié"; du?: string; au?: string },
): Promise<AssureSante[]> {
  const params = new URLSearchParams();
  if (filtre.statut && filtre.statut !== "tous") params.set("statut", filtre.statut);
  if (filtre.du) params.set("du", filtre.du);
  if (filtre.au) params.set("au", filtre.au);
  const data = await http.get<ApiPersonnePeriode[]>(`/contrats/${contratId}/population-historique?${params.toString()}`);
  return data.map((p) => ({
    id: p.id, nom: p.nom, prenom: p.prenom ?? undefined, matricule: p.matricule, contratId,
    benef: 0, cotisation: toNumber(p.cotisation), statut: p.statutPeriode,
    dateNaissance: p.dateNaissance ?? undefined, familleId: p.familleId ?? undefined,
    typeAssure: p.typeAssure ?? undefined, sexe: p.sexe ?? undefined, scolarise: p.scolarise,
  }));
}
