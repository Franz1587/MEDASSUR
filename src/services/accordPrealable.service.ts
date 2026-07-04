import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { AccordPrealable } from "@/types/accordPrealable";

interface ApiAccordPrealable {
  id: string;
  assureId: string;
  type: string;
  description: string;
  dateDemande: string;
  statutAnalyseMedicale: string;
  statutValidationFinanciere: string;
  decision: string;
  montantAutorise?: string | number;
  dateDecision?: string;
  assure: { nom: string };
}

function mapAccord(a: ApiAccordPrealable): AccordPrealable {
  return {
    id: a.id,
    assureId: a.assureId,
    assureNom: a.assure.nom,
    type: a.type,
    description: a.description,
    dateDemande: a.dateDemande,
    statutAnalyseMedicale: a.statutAnalyseMedicale,
    statutValidationFinanciere: a.statutValidationFinanciere,
    decision: a.decision,
    montantAutorise: a.montantAutorise !== undefined && a.montantAutorise !== null ? toNumber(a.montantAutorise) : undefined,
    dateDecision: a.dateDecision,
  };
}

export async function getAccordsPrealables(): Promise<AccordPrealable[]> {
  const data = await http.get<ApiAccordPrealable[]>("/accord-prealable");
  return data.map(mapAccord);
}

export async function decider(
  id: string,
  dto: { statutAnalyseMedicale?: string; statutValidationFinanciere?: string; decision?: string; montantAutorise?: number; dateDecision?: string },
): Promise<AccordPrealable> {
  const data = await http.patch<ApiAccordPrealable>(`/accord-prealable/${id}/decision`, dto);
  return mapAccord(data);
}
