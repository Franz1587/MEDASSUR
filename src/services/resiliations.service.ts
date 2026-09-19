import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Resiliation } from "@/types/resiliations";

interface ApiResiliation {
  id: string;
  contratId: string;
  motif: string;
  dateEffet: string;
  ristourne: string | number;
  initiateur: string;
  statut: string;
  contrat: { branche: string; client: { nom: string } };
}

function mapResiliation(r: ApiResiliation): Resiliation {
  return {
    id: r.id,
    contrat: r.contratId,
    client: r.contrat.client.nom,
    branche: r.contrat.branche,
    motif: r.motif,
    dateEffet: r.dateEffet,
    ristourne: toNumber(r.ristourne),
    initiateur: r.initiateur,
    statut: r.statut,
  };
}

export async function getResiliations(): Promise<Resiliation[]> {
  const data = await http.get<ApiResiliation[]>("/resiliations");
  return data.map(mapResiliation);
}

export interface ResiliationUpsertInput {
  contratId: string;
  motif: string;
  dateEffet: string;
  ristourne: number;
  initiateur: string;
  statut: "Demandée" | "Validée" | "Effective";
}

export async function createResiliation(payload: ResiliationUpsertInput): Promise<Resiliation> {
  const r = await http.post<ApiResiliation>("/resiliations", payload);
  return mapResiliation(r);
}

export async function validerResiliation(id: string): Promise<Resiliation> {
  const r = await http.patch<ApiResiliation>(`/resiliations/${id}/valider`);
  return mapResiliation(r);
}

export async function rendreResiliationEffective(id: string): Promise<Resiliation> {
  const r = await http.patch<ApiResiliation>(`/resiliations/${id}/effective`);
  return mapResiliation(r);
}

export async function deleteResiliation(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/resiliations/${id}`);
}
