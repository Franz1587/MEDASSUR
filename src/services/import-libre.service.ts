import { uploadFile } from "../lib/http";
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
}

export interface ResultatConfirmation {
  importees: number;
  ignorees: number;
}

export function apercuImportLibre(fichier: File): Promise<ResultatApercu> {
  return uploadFile<ResultatApercu>("/import-libre/apercu", fichier);
}

export function confirmerImportLibre(lignes: LigneApercu[]): Promise<ResultatConfirmation> {
  return http.post<ResultatConfirmation>("/import-libre/confirmer", { lignes });
}
