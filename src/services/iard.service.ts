import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { PoliceIard, IardRepartition } from "@/types/iard";

interface ApiPoliceIard {
  id: string;
  sousBranche: string;
  capitalAssure: string | number;
  prime: string | number;
  statut: string;
  client: { nom: string };
  compagnie: { nom: string };
}

export async function getPolicesIard(): Promise<PoliceIard[]> {
  const data = await http.get<ApiPoliceIard[]>("/iard");
  return data.map((p) => ({
    id: p.id,
    client: p.client.nom,
    sousBranche: p.sousBranche,
    compagnie: p.compagnie.nom,
    capitalAssure: toNumber(p.capitalAssure),
    prime: toNumber(p.prime),
    statut: p.statut,
  }));
}

/** Derived client-side from the fetched polices instead of a separate endpoint. */
export async function getIardRepartition(): Promise<IardRepartition[]> {
  const polices = await getPolicesIard();
  return polices.map((p) => ({ branche: p.sousBranche, value: p.prime }));
}
