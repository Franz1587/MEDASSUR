import { http, API_URL, getAccessToken } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { AppelOffres, AppelOffresUpsertInput, PropositionUpsertInput } from "@/types/appelOffres";
import type { Cotation } from "@/types/cotation";

interface ApiCotation {
  id: string;
  appelOffresId?: string | null;
  compagnieId?: string | null;
  compagnie?: { id: string; nom: string; logo?: string | null } | null;
  branche: string;
  clientNom: string;
  population: number;
  territorialite: string;
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
  garanties: { categorie: string; libelle: string; plafond: string }[];
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
  };
}

interface ApiAppelOffres {
  id: string;
  prospectId: string;
  prospect: { id: string; nom: string; logo?: string | null };
  clientNom: string;
  cahierCharges: string;
  garantiesDemandees: string;
  historiqueSinistres?: string;
  projectionSP: string | number;
  estimationPepm: string | number;
  estimationFondsRoulement: string | number;
  statut: string;
  dateCreation: string;
  propositions: { id: string; niveau: string; primeProposee: string | number; descriptionGaranties: string; statut: string; cotations: ApiCotation[] }[];
  cotations: ApiCotation[];
  documents: { id: string; nom: string; fichier: string; type: string; compagnieId?: string | null; tailleOctets: number; createdAt: string }[];
}

function mapAppelOffres(ao: ApiAppelOffres): AppelOffres {
  return {
    ...ao,
    prospect: { id: ao.prospect.id, nom: ao.prospect.nom, logo: ao.prospect.logo ?? null },
    projectionSP: toNumber(ao.projectionSP),
    estimationPepm: toNumber(ao.estimationPepm),
    estimationFondsRoulement: toNumber(ao.estimationFondsRoulement),
    propositions: ao.propositions.map((p) => ({ ...p, primeProposee: toNumber(p.primeProposee), cotations: p.cotations.map(mapCotation) })),
    cotations: ao.cotations.map(mapCotation),
  };
}

export async function getAppelsOffres(): Promise<AppelOffres[]> {
  const data = await http.get<ApiAppelOffres[]>("/appel-offres");
  return data.map(mapAppelOffres);
}

export async function getAppelOffres(id: string): Promise<AppelOffres> {
  const data = await http.get<ApiAppelOffres>(`/appel-offres/${id}`);
  return mapAppelOffres(data);
}

export async function createAppelOffres(payload: AppelOffresUpsertInput): Promise<AppelOffres> {
  const data = await http.post<ApiAppelOffres>("/appel-offres", payload);
  return mapAppelOffres(data);
}

export async function updateAppelOffres(id: string, payload: Partial<AppelOffresUpsertInput>): Promise<AppelOffres> {
  const data = await http.patch<ApiAppelOffres>(`/appel-offres/${id}`, payload);
  return mapAppelOffres(data);
}

export async function ajouterProposition(appelOffresId: string, payload: PropositionUpsertInput): Promise<AppelOffres> {
  const data = await http.post<ApiAppelOffres>(`/appel-offres/${appelOffresId}/propositions`, payload);
  return mapAppelOffres(data);
}

export async function modifierProposition(appelOffresId: string, propositionId: string, payload: Partial<PropositionUpsertInput>): Promise<AppelOffres> {
  const data = await http.patch<ApiAppelOffres>(`/appel-offres/${appelOffresId}/propositions/${propositionId}`, payload);
  return mapAppelOffres(data);
}

export async function supprimerProposition(appelOffresId: string, propositionId: string): Promise<AppelOffres> {
  const data = await http.delete<ApiAppelOffres>(`/appel-offres/${appelOffresId}/propositions/${propositionId}`);
  return mapAppelOffres(data);
}

// Import de documents réels (cahier des charges, offre compagnie) — même
// pattern que uploadCompagnieLogo (FormData + fetch brut, `http` ne gère
// que le JSON).
export async function uploaderDocumentAppelOffres(
  appelOffresId: string, file: File, options: { type: string; compagnieId?: string },
): Promise<AppelOffres> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("fichier", file);
  form.append("type", options.type);
  if (options.compagnieId) form.append("compagnieId", options.compagnieId);
  const res = await fetch(`${API_URL}/appel-offres/${appelOffresId}/documents`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`Import du document impossible (${res.status}): ${await res.text()}`);
  return mapAppelOffres(await res.json());
}

export async function supprimerDocumentAppelOffres(appelOffresId: string, documentId: string): Promise<AppelOffres> {
  const data = await http.delete<ApiAppelOffres>(`/appel-offres/${appelOffresId}/documents/${documentId}`);
  return mapAppelOffres(data);
}

// URL de téléchargement d'un document importé, servi statiquement (voir
// backend/src/main.ts, même pattern que compagnieLogoUrl).
export function appelOffresDocumentUrl(fichier: string): string {
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/appel-offres/${fichier}`;
}
