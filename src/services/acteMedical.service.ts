import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { ActeMedical } from "@/types/acteMedical";

interface ApiActeMedical {
  id: string;
  libelle: string;
  famille: string;
  prixDefaut: string | number;
  categorieGarantie?: string;
  lettreCleCode?: string | null;
  coefficient?: string | number | null;
}

function mapActe(a: ApiActeMedical): ActeMedical {
  return {
    id: a.id,
    libelle: a.libelle,
    famille: a.famille,
    prixDefaut: toNumber(a.prixDefaut),
    categorieGarantie: a.categorieGarantie,
    lettreCleCode: a.lettreCleCode ?? undefined,
    coefficient: a.coefficient != null ? toNumber(a.coefficient) : undefined,
  };
}

export async function getActesMedicaux(famille?: string): Promise<ActeMedical[]> {
  const data = await http.get<ApiActeMedical[]>(famille ? `/actes-medicaux?famille=${encodeURIComponent(famille)}` : "/actes-medicaux");
  return data.map(mapActe);
}

export interface ActeMedicalUpsertInput {
  libelle: string;
  famille: string;
  // Facultatif dès que lettreCleCode est renseigné — recalculé côté
  // serveur dans ce cas (voir ActesMedicauxService.resoudrePrixCodifie).
  prixDefaut?: number;
  categorieGarantie?: string;
  lettreCleCode?: string;
  coefficient?: number;
}

export async function createActeMedical(payload: ActeMedicalUpsertInput): Promise<ActeMedical> {
  const data = await http.post<ApiActeMedical>("/actes-medicaux", payload);
  return mapActe(data);
}

export async function updateActeMedical(id: string, payload: Partial<ActeMedicalUpsertInput>): Promise<ActeMedical> {
  const data = await http.patch<ApiActeMedical>(`/actes-medicaux/${id}`, payload);
  return mapActe(data);
}

export async function deleteActeMedical(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/actes-medicaux/${id}`);
}
