import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { FondsDeRoulement } from "@/types/fondsDeRoulement";

interface ApiFondsDeRoulement {
  id: string;
  contratId: string;
  montantInitial: string | number;
  montantConsomme: string | number;
  seuilAlerte: string | number;
  statut: string;
  dateAlimentation: string;
  contrat: { client: { nom: string } };
}

function mapFonds(f: ApiFondsDeRoulement): FondsDeRoulement {
  return {
    id: f.id,
    contratId: f.contratId,
    clientNom: f.contrat.client.nom,
    montantInitial: toNumber(f.montantInitial),
    montantConsomme: toNumber(f.montantConsomme),
    seuilAlerte: toNumber(f.seuilAlerte),
    statut: f.statut,
    dateAlimentation: f.dateAlimentation,
  };
}

export async function getFondsDeRoulement(): Promise<FondsDeRoulement[]> {
  const data = await http.get<ApiFondsDeRoulement[]>("/fonds-de-roulement");
  return data.map(mapFonds);
}

export interface FondsUpsertInput {
  contratId: string;
  montantInitial: number;
  seuilAlerte: number;
  dateAlimentation: string;
}

export async function createFonds(payload: FondsUpsertInput): Promise<FondsDeRoulement> {
  const f = await http.post<ApiFondsDeRoulement>("/fonds-de-roulement", payload);
  return mapFonds(f);
}

export async function consommerFonds(id: string, montant: number): Promise<FondsDeRoulement> {
  const f = await http.patch<ApiFondsDeRoulement>(`/fonds-de-roulement/${id}/consommer`, { montant });
  return mapFonds(f);
}
