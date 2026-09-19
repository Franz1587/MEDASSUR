import { http, API_URL, getAccessToken } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Cotation, CotationInput } from "@/types/cotation";

interface ApiCotation {
  id: string;
  appelOffresId?: string | null;
  compagnieId?: string | null;
  gestionnaireId?: string | null;
  compagnie?: { id: string; nom: string; logo?: string | null } | null;
  branche: string;
  clientNom: string;
  population: number;
  territorialite: string;
  tauxCouvertureAmbulatoire?: string | null;
  tauxCouvertureHospitalisation?: string | null;
  exclusions?: string | null;
  clauseAjustement?: string | null;
  limiteAgeAdulte?: number | null;
  limiteAgeEnfant?: number | null;
  plafondFamilial?: string | number | null;
  conditionsFermete?: string | null;
  primeNette: string | number;
  montantCartes: string | number;
  montantAccessoires: string | number;
  montantTaxe: string | number;
  primeTTC: string | number;
  dateCreation: string;
  logo?: string | null;
  garanties: { categorie: string; libelle: string; plafond: string; tauxStructurePrivee?: string | null; tauxStructurePublique?: string | null }[];
}

function mapCotation(c: ApiCotation): Cotation {
  return {
    ...c,
    plafondFamilial: c.plafondFamilial !== null && c.plafondFamilial !== undefined ? toNumber(c.plafondFamilial) : null,
    primeNette: toNumber(c.primeNette),
    montantCartes: toNumber(c.montantCartes),
    montantAccessoires: toNumber(c.montantAccessoires),
    montantTaxe: toNumber(c.montantTaxe),
    primeTTC: toNumber(c.primeTTC),
    garanties: c.garanties.map((g) => ({
      categorie: g.categorie, libelle: g.libelle, plafond: g.plafond,
      tauxStructurePrivee: g.tauxStructurePrivee ?? undefined, tauxStructurePublique: g.tauxStructurePublique ?? undefined,
    })),
  };
}

export async function getCotations(filtre?: { appelOffresId?: string }): Promise<Cotation[]> {
  const params = filtre?.appelOffresId ? `?appelOffresId=${encodeURIComponent(filtre.appelOffresId)}` : "";
  const data = await http.get<ApiCotation[]>(`/cotation${params}`);
  return data.map(mapCotation);
}

export async function getCotation(id: string): Promise<Cotation> {
  const data = await http.get<ApiCotation>(`/cotation/${id}`);
  return mapCotation(data);
}

export async function createCotation(input: CotationInput): Promise<Cotation> {
  const data = await http.post<ApiCotation>("/cotation", input);
  return mapCotation(data);
}

export async function updateCotation(id: string, input: Partial<CotationInput>): Promise<Cotation> {
  const data = await http.patch<ApiCotation>(`/cotation/${id}`, input);
  return mapCotation(data);
}

export async function deleteCotation(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/cotation/${id}`);
}

// URL publique d'un logo attaché directement à une cotation sans appel
// d'offres (voir POST /cotation/:id/logo) — même pattern que
// compagnieLogoUrl/prospectLogoUrl.
export function cotationLogoUrl(logo?: string | null): string | undefined {
  if (!logo) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/logos-cotations/${logo}`;
}

export async function uploadCotationLogo(id: string, file: File): Promise<Cotation> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("logo", file);
  const res = await fetch(`${API_URL}/cotation/${id}/logo`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /cotation/${id}/logo failed (${res.status}): ${await res.text()}`);
  return mapCotation(await res.json());
}

export async function deleteCotationLogo(id: string): Promise<Cotation> {
  const c = await http.delete<ApiCotation>(`/cotation/${id}/logo`);
  return mapCotation(c);
}
