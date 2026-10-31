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
  // Mode correction (2026-10)
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
}

export interface ResultatConfirmation {
  importees: number;
  corrigees: number;
  ignorees: number;
}

const API_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? "http://localhost:3001/api";

function getToken(): string | null {
  return localStorage.getItem("medassur-access-token");
}

export type TypeImportLibre = "factures" | "souscripteurs" | "contrats" | "assures" | "prises-en-charge" | "reglements";

export async function apercuImportLibre(fichier: File, modeCorrection = false, type: TypeImportLibre = "factures"): Promise<ResultatApercu> {
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
  return res.json() as Promise<ResultatApercu>;
}

export function confirmerImportLibre(lignes: LigneApercu[], modeCorrection = false, type: TypeImportLibre = "factures"): Promise<ResultatConfirmation> {
  return http.post<ResultatConfirmation>(`/import-libre/confirmer?type=${encodeURIComponent(type)}`, { lignes, modeCorrection });
}
