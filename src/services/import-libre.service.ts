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
  crees?: number;
  miseAJour?: number;
  ignorees: number;
}

const API_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? "http://localhost:3001/api";

function getToken(): string | null {
  return localStorage.getItem("medassur-access-token");
}

export type TypeImportLibre = "auto" | "factures" | "population" | "actes-medicaux" | "souscripteurs" | "contrats" | "assures" | "prises-en-charge" | "reglements";

export type ResultatImportLibre = ResultatApercu | ResultatPopulation | ResultatActesMedicaux;

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
