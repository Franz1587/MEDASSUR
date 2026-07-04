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

export async function getResiliations(): Promise<Resiliation[]> {
  const data = await http.get<ApiResiliation[]>("/resiliations");
  return data.map((r) => ({
    id: r.id,
    contrat: r.contratId,
    client: r.contrat.client.nom,
    branche: r.contrat.branche,
    motif: r.motif,
    dateEffet: r.dateEffet,
    ristourne: toNumber(r.ristourne),
    initiateur: r.initiateur,
    statut: r.statut,
  }));
}
