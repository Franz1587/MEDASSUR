import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { LettreCle } from "@/types/lettresCles";

interface ApiLettreCle {
  code: string;
  libelle: string;
  valeurUnitaire: string | number;
  categoriesGarantie?: string[] | null;
  specialites?: string[] | null;
  actif: boolean;
}

function mapLettreCle(l: ApiLettreCle): LettreCle {
  return {
    code: l.code,
    libelle: l.libelle,
    valeurUnitaire: toNumber(l.valeurUnitaire),
    categoriesGarantie: l.categoriesGarantie ?? [],
    specialites: l.specialites ?? [],
    actif: l.actif,
  };
}

export async function getLettresCles(): Promise<LettreCle[]> {
  const data = await http.get<ApiLettreCle[]>("/lettres-cles");
  return data.map(mapLettreCle);
}

export interface LettreCleUpsertInput {
  code: string;
  libelle: string;
  valeurUnitaire: number;
  categoriesGarantie?: string[];
  specialites?: string[];
  actif?: boolean;
}

export async function createLettreCle(payload: LettreCleUpsertInput): Promise<LettreCle> {
  const data = await http.post<ApiLettreCle>("/lettres-cles", payload);
  return mapLettreCle(data);
}

export async function updateLettreCle(code: string, payload: Partial<LettreCleUpsertInput>): Promise<LettreCle> {
  const data = await http.patch<ApiLettreCle>(`/lettres-cles/${encodeURIComponent(code)}`, payload);
  return mapLettreCle(data);
}

export async function deleteLettreCle(code: string): Promise<{ code: string }> {
  return http.delete<{ code: string }>(`/lettres-cles/${encodeURIComponent(code)}`);
}
