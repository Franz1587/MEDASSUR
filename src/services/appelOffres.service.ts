import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { AppelOffres } from "@/types/appelOffres";

interface ApiAppelOffres {
  id: string;
  prospectId: string;
  clientNom: string;
  cahierCharges: string;
  garantiesDemandees: string;
  historiqueSinistres?: string;
  projectionSP: string | number;
  estimationPepm: string | number;
  estimationFondsRoulement: string | number;
  statut: string;
  dateCreation: string;
  propositions: { id: string; niveau: string; primeProposee: string | number; descriptionGaranties: string; statut: string }[];
}

function mapAppelOffres(ao: ApiAppelOffres): AppelOffres {
  return {
    ...ao,
    projectionSP: toNumber(ao.projectionSP),
    estimationPepm: toNumber(ao.estimationPepm),
    estimationFondsRoulement: toNumber(ao.estimationFondsRoulement),
    propositions: ao.propositions.map((p) => ({ ...p, primeProposee: toNumber(p.primeProposee) })),
  };
}

export async function getAppelsOffres(): Promise<AppelOffres[]> {
  const data = await http.get<ApiAppelOffres[]>("/appel-offres");
  return data.map(mapAppelOffres);
}
