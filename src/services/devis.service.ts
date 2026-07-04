import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Devis } from "@/types/devis";

interface ApiDevis {
  id: string;
  branche: string;
  primeEstimee: string | number;
  dateCreation: string;
  validite: string;
  statut: string;
  client: { nom: string };
  offres: { compagnieNom: string; prime: string | number }[];
}

export async function getDevis(): Promise<Devis[]> {
  const data = await http.get<ApiDevis[]>("/devis");
  return data.map((d) => ({
    id: d.id,
    client: d.client.nom,
    branche: d.branche,
    compagnies: d.offres.map((o) => ({ nom: o.compagnieNom, prime: toNumber(o.prime) })),
    primeEstimee: toNumber(d.primeEstimee),
    dateCreation: d.dateCreation,
    validite: d.validite,
    statut: d.statut,
  }));
}
