import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Renouvellement } from "@/types/renouvellements";

interface ApiRenouvellement {
  id: string;
  contratId: string;
  joursRestants: number;
  primeActuelle: string | number;
  primeProposee: string | number;
  sinistralite: string;
  statut: string;
  contrat: { branche: string; dateFin: string; client: { nom: string }; compagnie: { nom: string } };
}

export async function getRenouvellements(): Promise<Renouvellement[]> {
  const data = await http.get<ApiRenouvellement[]>("/renouvellements");
  return data.map((r) => ({
    id: r.id,
    contrat: r.contratId,
    client: r.contrat.client.nom,
    branche: r.contrat.branche,
    compagnie: r.contrat.compagnie.nom,
    dateFin: r.contrat.dateFin,
    joursRestants: r.joursRestants,
    primeActuelle: toNumber(r.primeActuelle),
    primeProposee: toNumber(r.primeProposee),
    sinistralite: r.sinistralite,
    statut: r.statut,
  }));
}
