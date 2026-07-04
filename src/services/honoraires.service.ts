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

export async function getHonoraires(): Promise<HonorairesGestion[]> {
  const data = await http.get<ApiHonoraires[]>("/honoraires");
  return data.map((h) => ({
    id: h.id,
    contratId: h.contratId,
    clientNom: h.contrat.client.nom,
    periode: h.periode,
    montantSinistres: toNumber(h.montantSinistres),
    tauxHonoraires: toNumber(h.tauxHonoraires),
    montantHonoraires: toNumber(h.montantHonoraires),
    plafond: h.plafond !== undefined && h.plafond !== null ? toNumber(h.plafond) : undefined,
    statut: h.statut,
  }));
}
