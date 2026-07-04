import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { ScoringFraude } from "@/types/fraude";

interface ApiScoringFraude {
  id: string;
  cible: string;
  cibleId: string;
  cibleNom: string;
  score: string | number;
  motifs: string;
  dateEvaluation: string;
}

export async function getScoringsFraude(): Promise<ScoringFraude[]> {
  const data = await http.get<ApiScoringFraude[]>("/fraude");
  return data.map((s) => ({ ...s, score: toNumber(s.score) }));
}

export async function evaluerAssure(assureId: string): Promise<ScoringFraude> {
  const data = await http.post<ApiScoringFraude>(`/fraude/evaluer/assure/${assureId}`);
  return { ...data, score: toNumber(data.score) };
}
