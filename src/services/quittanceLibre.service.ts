import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { QuittanceLibre, QuittanceLibreTranche } from "@/types/quittanceLibre";

interface ApiEncaissement {
  id: string;
  dateEncaissement: string;
  modePaiement?: string | null;
  banque?: { nom: string } | null;
  referencePaiement?: string | null;
}

interface ApiTranche {
  id: string;
  numero: number;
  montant: string | number;
  dateEcheance: string;
  primeNette: string | number;
  accessoires: string | number;
  taxe: string | number;
  encaissement?: ApiEncaissement | null;
}

interface ApiQuittanceLibre {
  id: string;
  contratId: string;
  montantTotal: string | number;
  dateCreation: string;
  statut: "En cours" | "Soldée" | "Annulée";
  motifAnnulation?: string | null;
  createdAt: string;
  contrat: { client: { nom: string }; compagnie: { nom: string } };
  gestionnaire?: { nom: string } | null;
  tranches: ApiTranche[];
}

function mapTranche(t: ApiTranche): QuittanceLibreTranche {
  return {
    id: t.id,
    numero: t.numero,
    montant: toNumber(t.montant),
    dateEcheance: t.dateEcheance,
    primeNette: toNumber(t.primeNette),
    accessoires: toNumber(t.accessoires),
    taxe: toNumber(t.taxe),
    encaissement: t.encaissement
      ? {
          id: t.encaissement.id,
          dateEncaissement: t.encaissement.dateEncaissement,
          modePaiement: t.encaissement.modePaiement ?? undefined,
          banqueNom: t.encaissement.banque?.nom ?? undefined,
          referencePaiement: t.encaissement.referencePaiement ?? undefined,
        }
      : undefined,
  };
}

function mapQuittanceLibre(q: ApiQuittanceLibre): QuittanceLibre {
  return {
    id: q.id,
    contratId: q.contratId,
    clientNom: q.contrat.client.nom,
    compagnieNom: q.contrat.compagnie.nom,
    montantTotal: toNumber(q.montantTotal),
    dateCreation: q.dateCreation,
    statut: q.statut,
    motifAnnulation: q.motifAnnulation ?? undefined,
    gestionnaireNom: q.gestionnaire?.nom,
    createdAt: q.createdAt,
    tranches: q.tranches.map(mapTranche),
  };
}

export interface CreateQuittanceLibrePayload {
  contratId: string;
  montantTotal: number;
  dateCreation: string;
  // primeNette/accessoires : saisie manuelle (mode "Personnalisée") — quand
  // présents, le serveur les prend pour argent comptant et RECALCULE
  // taxe/montant à partir d'eux (voir QuittancesLibresService.create).
  tranches: { montant: number; dateEcheance: string; primeNette?: number; accessoires?: number }[];
}

export interface PayerTranchePayload {
  dateEncaissement: string;
  modePaiement?: string;
  // Chèque/Virement uniquement — voir demande utilisateur.
  banqueId?: string;
  referencePaiement?: string;
}

export async function getQuittancesLibres(filtres?: { contratId?: string; statut?: string }): Promise<QuittanceLibre[]> {
  const params = new URLSearchParams();
  if (filtres?.contratId) params.set("contratId", filtres.contratId);
  if (filtres?.statut) params.set("statut", filtres.statut);
  const qs = params.toString();
  const data = await http.get<ApiQuittanceLibre[]>(`/quittances-libres${qs ? `?${qs}` : ""}`);
  return data.map(mapQuittanceLibre);
}

export async function createQuittanceLibre(payload: CreateQuittanceLibrePayload): Promise<QuittanceLibre> {
  const q = await http.post<ApiQuittanceLibre>("/quittances-libres", payload);
  return mapQuittanceLibre(q);
}

export async function annulerQuittanceLibre(id: string, motif: string): Promise<QuittanceLibre> {
  const q = await http.patch<ApiQuittanceLibre>(`/quittances-libres/${id}/annuler`, { motif });
  return mapQuittanceLibre(q);
}

export async function payerTranche(trancheId: string, payload: PayerTranchePayload): Promise<QuittanceLibre> {
  const q = await http.patch<ApiQuittanceLibre>(`/quittances-libres/tranches/${trancheId}/payer`, payload);
  return mapQuittanceLibre(q);
}

export async function annulerPaiementTranche(trancheId: string): Promise<QuittanceLibre> {
  const q = await http.patch<ApiQuittanceLibre>(`/quittances-libres/tranches/${trancheId}/annuler-paiement`);
  return mapQuittanceLibre(q);
}
