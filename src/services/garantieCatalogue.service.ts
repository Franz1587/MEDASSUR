import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { GarantieCatalogueItem } from "@/types/garantieCatalogue";

interface ApiGarantieCatalogueItem {
  id: string;
  branche: string;
  categorie: string;
  libelle: string;
  tauxAssureDefaut?: string | number;
  tauxAyantsDroitDefaut?: string | number;
  plafondDefaut?: string;
}

function mapItem(g: ApiGarantieCatalogueItem): GarantieCatalogueItem {
  return {
    id: g.id,
    branche: g.branche === "Assistance" ? "Assistance" : "Maladie",
    categorie: g.categorie,
    libelle: g.libelle,
    tauxAssureDefaut: g.tauxAssureDefaut !== undefined && g.tauxAssureDefaut !== null ? toNumber(g.tauxAssureDefaut) : undefined,
    tauxAyantsDroitDefaut: g.tauxAyantsDroitDefaut !== undefined && g.tauxAyantsDroitDefaut !== null ? toNumber(g.tauxAyantsDroitDefaut) : undefined,
    plafondDefaut: g.plafondDefaut,
  };
}

export async function getGarantieCatalogue(): Promise<GarantieCatalogueItem[]> {
  const data = await http.get<ApiGarantieCatalogueItem[]>("/garantie-catalogue");
  return data.map(mapItem);
}

export interface GarantieCatalogueUpsertInput {
  branche?: "Maladie" | "Assistance";
  categorie: string;
  libelle: string;
  tauxAssureDefaut?: number;
  tauxAyantsDroitDefaut?: number;
  plafondDefaut?: string;
}

export async function createGarantieCatalogueItem(payload: GarantieCatalogueUpsertInput): Promise<GarantieCatalogueItem> {
  const data = await http.post<ApiGarantieCatalogueItem>("/garantie-catalogue", payload);
  return mapItem(data);
}

export async function deleteGarantieCatalogueItem(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/garantie-catalogue/${id}`);
}
