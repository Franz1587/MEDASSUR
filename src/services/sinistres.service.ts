import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Sinistre } from "@/types/sinistres";

interface ApiSinistre {
  id: string;
  branche: string;
  date: string;
  description: string;
  montant: string | number;
  statut: string;
  priorite: string;
  client: { nom: string };
  gestionnaireId?: string | null;
}

function mapSinistre(s: ApiSinistre): Sinistre {
  return {
    id: s.id,
    client: s.client.nom,
    branche: s.branche,
    date: s.date,
    description: s.description,
    montant: toNumber(s.montant),
    statut: s.statut,
    priorite: s.priorite,
    gestionnaireId: s.gestionnaireId ?? null,
  };
}

export async function getSinistres(): Promise<Sinistre[]> {
  const data = await http.get<ApiSinistre[]>("/sinistres");
  return data.map(mapSinistre);
}

/** Derived client-side from each sinistre's own `statut`, rather than a
 * separately maintained mock map that could drift out of sync. */
export async function getSinistresKanban(): Promise<Record<string, string[]>> {
  const sinistres = await getSinistres();
  const columns: Record<string, string[]> = {};
  for (const s of sinistres) {
    (columns[s.statut] ??= []).push(s.id);
  }
  return columns;
}

export interface SinistreUpsertInput {
  clientId: string;
  branche: string;
  date: string;
  description: string;
  montant: number;
  statut: string;
  priorite: "Normal" | "Haute" | "Urgent";
}

export async function createSinistre(payload: SinistreUpsertInput): Promise<Sinistre> {
  const s = await http.post<ApiSinistre>("/sinistres", payload);
  return mapSinistre(s);
}

export async function updateSinistreStatut(id: string, statut: string): Promise<Sinistre> {
  const s = await http.patch<ApiSinistre>(`/sinistres/${id}`, { statut });
  return mapSinistre(s);
}

export async function deleteSinistre(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/sinistres/${id}`);
}
