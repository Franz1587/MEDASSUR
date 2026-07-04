import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Impaye } from "@/types/recouvrement";

interface ApiImpaye {
  id: string;
  contratId: string;
  montantDu: string | number;
  joursRetard: number;
  niveau: string;
  canal: string;
  statut: string;
  client: { nom: string };
}

function mapImpaye(i: ApiImpaye): Impaye {
  return {
    id: i.id,
    client: i.client.nom,
    contrat: i.contratId,
    montantDu: toNumber(i.montantDu),
    joursRetard: i.joursRetard,
    niveau: i.niveau,
    canal: i.canal,
    statut: i.statut,
  };
}

export async function getImpayes(): Promise<Impaye[]> {
  const data = await http.get<ApiImpaye[]>("/recouvrement");
  return data.map(mapImpaye);
}

/** Derived client-side from each impayé's own `niveau` of relance. */
export async function getRecouvrementKanban(): Promise<Record<string, string[]>> {
  const impayes = await getImpayes();
  const columns: Record<string, string[]> = {};
  for (const i of impayes) {
    (columns[i.niveau] ??= []).push(i.id);
  }
  return columns;
}
