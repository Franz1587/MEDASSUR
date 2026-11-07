import { http } from "../lib/http";

export interface LigneApercu {
  referenceFacture: string;
  designation: string;
  categorie: string;
  matricule: string;
  beneficiaire: string;
  prestataireNom: string;
  datePrestation: string;
  montantTotal: number;
  partPatient: number;
  partFinanceur: number;
  statut: string;
  assureId: string | null;
  contratId: string | null;
  prestataireId: string | null;
  erreur: string | null;
  doublon: boolean;
  miseAJour?: boolean;
  priseEnChargeId?: string;
}

export interface ResultatApercu {
  contratRef: string;
  organisme: string;
  periode: string;
  lignes: LigneApercu[];
  totalLignes: number;
  totalResolues: number;
  totalDoublons: number;
  totalErreurs: number;
  totalMisesAJour: number;
  typeDetecte?: TypeImportLibre;
  apercu?: string;
  colonnesDetectees?: string[];
}

export interface LignePopulation {
  matricule: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  sexe: string;
  typeAssure: string;
  prime: number;
  dateEffet: string;
  statutFichier: string;
  assureId: string | null;
  contratId: string | null;
  statutActuel: string | null;
  changementStatut: boolean;
  changementContrat: boolean;
  contratIdNouveau: string | null;
  erreur: string | null;
  doublon: boolean;
}

export interface ResultatPopulation {
  police: string;
  organisme: string;
  periode: string;
  lignes: LignePopulation[];
  totalLignes: number;
  totalNouveaux: number;
  totalChangementsStatut: number;
  totalChangementsContrat: number;
  totalDoublons: number;
  totalErreurs: number;
  typeDetecte: "population";
}

export interface LigneActeMedical {
  code: string;
  libelle: string;
  famille: string;
  prixDefaut: number;
  categorieGarantie: string;
  acteId: string | null;
  estNouvel: boolean;
  prixActuel: number | null;
  changementPrix: boolean;
  erreur: string | null;
}

export interface ResultatActesMedicaux {
  titre: string;
  lignes: LigneActeMedical[];
  totalLignes: number;
  totalNouveaux: number;
  totalMisesAJour: number;
  totalDoublons: number;
  totalErreurs: number;
  typeDetecte: "actes-medicaux";
}

export interface ResultatConfirmation {
  importees?: number;
  corrigees?: number;
  doublonsAnnules?: number;
  crees?: number;
  miseAJour?: number;
  ignorees: number;
}

const API_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? "http://localhost:3001/api";

function getToken(): string | null {
  return localStorage.getItem("medassur-access-token");
}

export type TypeImportLibre = "auto" | "factures" | "population" | "actes-medicaux" | "souscripteurs" | "contrats" | "assures" | "prises-en-charge" | "reglements";

// ── Classeur PEC (Prises en charge / entente préalable) ──────────────────
export interface EchantillonPec { ref: string; beneficiaire: string; souscripteur: string; detail: string }
export interface EchantillonCorrection { ref: string; acte: string; fraisReels: number; ancienne: number; nouvelle: number }
export interface ResultatPec {
  typeDetecte: "pec";
  planId: string;
  nomFichier: string;
  totalPec: number;
  totalActes: number;
  assuresTrouves: number;
  assuresNonTrouves: number;
  prestatairesTouves: number;
  prestatairesNonTrouves: number;
  montantsNegatifs: number;
  doublons: number;
  actesACreer: number;
  statuts: Record<string, number>;
  anomalies: { type: string; nombre: number; exemples: string[] }[];
  echantillons: {
    nonTrouves: EchantillonPec[];
    corriges: EchantillonCorrection[];
    doublons: EchantillonPec[];
  };
}
export interface BilanPec { crees: number; creesAccords: number; doublonsIgnores: number; montantsCorrigés: number; erreurs: string[] }

export function estPec(r: ResultatImportLibre): r is ResultatPec {
  return (r as ResultatPec).typeDetecte === "pec";
}
export function confirmerPec(planId: string): Promise<BilanPec> {
  return http.post<BilanPec>("/import-libre/confirmer-pec", { planId });
}

// Classeur multi-feuilles (participants + synthèse par contrat) — voir ImportClasseurService.
export interface OptionsClasseur {
  statuts: boolean;
  contrats: boolean;
  telephones: boolean;
  factures: boolean;
  identite: boolean;
  types: boolean;
  matricules: boolean;
  creerAbsents: boolean;
  produits: "aucun" | "vides" | "tous";
}

export interface LigneEchantillonClasseur { matricule: string; nom: string; detail: string }

export interface AnalyseFeuilleClasseur {
  nom: string; role: string; lignes: number;
  colonnes: { entete: string; sens: string; remplies: number; rapprochees?: number }[];
  resume: string[];
}

export interface ResultatClasseur {
  typeDetecte: "classeur";
  planId: string;
  nomFichier: string;
  feuilles: AnalyseFeuilleClasseur[];
  totaux: {
    lignesParticipants: number; assuresTrouves: number; inchanges: number;
    suspensions: number; reactivations: number; deplacements: number; membresSuivent: number;
    telephonesAjoutes: number; absents: number; prestationsSuivent: number;
    naissancesAjoutees: number; sexesAjoutes: number; typesCorriges: number; rattachements: number; alignements: number;
    contratsProduitVide: number; contratsProduitEcart: number; contratsSouscripteurEcart: number;
  };
  echantillons: {
    suspensions: LigneEchantillonClasseur[]; reactivations: LigneEchantillonClasseur[]; deplacements: LigneEchantillonClasseur[];
    telephones: LigneEchantillonClasseur[]; absents: LigneEchantillonClasseur[]; types: LigneEchantillonClasseur[]; alignements: LigneEchantillonClasseur[];
  };
  contrats: { police: string; produitActuel: string; produitFichier: string; souscripteurBase: string; souscripteurFichier: string; ecartSouscripteur: boolean }[];
  ecarts: { champ: string; nombre: number; exemples: string[]; note?: string }[];
  anomalies: { type: string; libelle: string; nombre: number; exemples: string[] }[];
  constats: string[];
  options: OptionsClasseur;
}

export interface BilanClasseur {
  statutsModifies: number; deplaces: number; membresDeplaces: number; prestationsRattachees: number;
  facturesRattachees: number; ententesRattachees: number; telephonesAjoutes: number; crees: number; produitsMisAJour: number;
  naissancesAjoutees: number; sexesAjoutes: number; typesCorriges: number; rattaches: number; alignes: number;
  ignores: number; erreurs: string[];
}

export type ResultatImportLibre = ResultatApercu | ResultatPopulation | ResultatActesMedicaux | ResultatClasseur | ResultatPec;

export function estClasseur(r: ResultatImportLibre): r is ResultatClasseur {
  return (r as ResultatClasseur).typeDetecte === "classeur";
}

export function confirmerClasseur(planId: string, options: OptionsClasseur): Promise<BilanClasseur> {
  return http.post<BilanClasseur>("/import-libre/confirmer-classeur", { planId, options });
}

export function estPopulation(r: ResultatImportLibre): r is ResultatPopulation {
  return (r as ResultatPopulation).typeDetecte === "population";
}

export function estActesMedicaux(r: ResultatImportLibre): r is ResultatActesMedicaux {
  return (r as ResultatActesMedicaux).typeDetecte === "actes-medicaux";
}

export async function apercuImportLibre(fichier: File, modeCorrection = false, type: TypeImportLibre = "auto"): Promise<ResultatImportLibre> {
  const form = new FormData();
  form.append("fichier", fichier);
  form.append("modeCorrection", String(modeCorrection));
  const token = getToken();
  const res = await fetch(`${API_URL}/import-libre/apercu?type=${encodeURIComponent(type)}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ResultatImportLibre>;
}

export function confirmerImportLibre(lignes: LigneApercu[], modeCorrection = false, type: TypeImportLibre = "factures"): Promise<ResultatConfirmation> {
  return http.post<ResultatConfirmation>(`/import-libre/confirmer?type=${encodeURIComponent(type)}`, { lignes, modeCorrection });
}

export function confirmerPopulation(lignes: LignePopulation[]): Promise<ResultatConfirmation> {
  return http.post<ResultatConfirmation>("/import-libre/confirmer-population", { lignes });
}

export function confirmerActesMedicaux(lignes: LigneActeMedical[]): Promise<ResultatConfirmation> {
  return http.post<ResultatConfirmation>("/import-libre/confirmer-actes", { lignes });
}
