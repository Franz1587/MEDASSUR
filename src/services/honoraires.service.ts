import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { HonorairesGestion } from "@/types/honoraires";

interface ApiHonoraires {
  id: string;
  contratId: string;
  periode: string;
  montantSinistres: string | number;
  tauxHonoraires: string | number;
  montantHonoraires: string | number;
  plafond?: string | number;
  statut: string;
  contrat: { client: { nom: string } };
}

function mapHonoraires(h: ApiHonoraires): HonorairesGestion {
  return {
    id: h.id,
    contratId: h.contratId,
    clientNom: h.contrat.client.nom,
    periode: h.periode,
    montantSinistres: toNumber(h.montantSinistres),
    tauxHonoraires: toNumber(h.tauxHonoraires),
    montantHonoraires: toNumber(h.montantHonoraires),
    plafond: h.plafond !== undefined && h.plafond !== null ? toNumber(h.plafond) : undefined,
    statut: h.statut,
  };
}

export async function getHonoraires(): Promise<HonorairesGestion[]> {
  const data = await http.get<ApiHonoraires[]>("/honoraires");
  return data.map(mapHonoraires);
}

export interface HonorairesUpsertInput {
  contratId: string;
  periode: string;
  montantSinistres: number;
  tauxHonoraires: number;
  plafond?: number;
}

export async function createHonoraires(payload: HonorairesUpsertInput): Promise<HonorairesGestion> {
  const h = await http.post<ApiHonoraires>("/honoraires", payload);
  return mapHonoraires(h);
}

export async function facturerHonoraires(id: string): Promise<HonorairesGestion> {
  const h = await http.patch<ApiHonoraires>(`/honoraires/${id}/facturer`);
  return mapHonoraires(h);
}
