import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Prestataire } from "@/types/prestataires";

interface ApiPrestataire {
  id: string;
  nom: string;
  type: string;
  pays: string;
  ville: string;
  statutConvention: string;
  dateConventionnement?: string;
  delaiPaiementMoyen?: number;
  scoreQualite?: string | number;
  motifSuspension?: string;
  grillesTarifaires: { acte: string; plafond: string | number }[];
}

function mapPrestataire(p: ApiPrestataire): Prestataire {
  return {
    ...p,
    scoreQualite: p.scoreQualite !== undefined && p.scoreQualite !== null ? toNumber(p.scoreQualite) : undefined,
    grillesTarifaires: p.grillesTarifaires.map((g) => ({ acte: g.acte, plafond: toNumber(g.plafond) })),
  };
}

export async function getPrestataires(): Promise<Prestataire[]> {
  const data = await http.get<ApiPrestataire[]>("/prestataires");
  return data.map(mapPrestataire);
}

export async function suspendrePrestataire(id: string, motif: string): Promise<Prestataire> {
  const data = await http.patch<ApiPrestataire>(`/prestataires/${id}/suspendre`, { motif });
  return mapPrestataire(data);
}
