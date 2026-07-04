import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Avenant } from "@/types/avenants";

interface ApiAvenant {
  id: string;
  contratId: string;
  type: string;
  description: string;
  primeAvant: string | number;
  primeApres: string | number;
  dateEffet: string;
  statut: string;
  contrat: { client: { nom: string } };
}

export async function getAvenants(): Promise<Avenant[]> {
  const data = await http.get<ApiAvenant[]>("/avenants");
  return data.map((a) => ({
    id: a.id,
    contrat: a.contratId,
    client: a.contrat.client.nom,
    type: a.type,
    description: a.description,
    primeAvant: toNumber(a.primeAvant),
    primeApres: toNumber(a.primeApres),
    dateEffet: a.dateEffet,
    statut: a.statut,
  }));
}
