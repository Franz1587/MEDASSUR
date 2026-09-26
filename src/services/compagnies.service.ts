import { http, API_URL, getAccessToken } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type {
  Compagnie, AccessoireTranche, SurprimeAge, ClauseAjustement, Territorialite, TauxCouverture, GarantieCatalogueLigne,
} from "@/types/compagnies";

interface ApiAccessoireTranche { id: string; borneMin: string | number; borneMax: string | number | null; montant: string | number; }
interface ApiSurprimeAge { id: string; ageMin: number; ageMax: number | null; tauxPourcent: string | number; }
interface ApiClauseAjustement { id: string; spMin: string | number; spMax: string | number | null; tauxAjustement: string | number; description: string | null; }
interface ApiTerritorialite { id: string; libelle: string; }
interface ApiTauxCouverture { id: string; tauxAmbulatoire: string; tauxHospitalisation: string; }
interface ApiGarantieCatalogueLigne {
  id: string; branche: string; categorie: string; libelle: string;
  tauxAssureDefaut: string | number | null; tauxAyantsDroitDefaut: string | number | null; plafondDefaut: string | null;
  tauxStructurePriveeDefaut: string | null; tauxStructurePubliqueDefaut: string | null;
}

interface ApiCompagnie {
  id: string;
  nom: string;
  pays: string;
  code?: string | null;
  prefixeNumeroPolice?: string | null;
  codeCourtier?: string | null;
  compagnieMereId?: string | null;
  compagnieMere?: { id: string; nom: string } | null;
  agenceId?: string | null;
  agence?: { id: string; nom: string; code?: string | null } | null;
  logo?: string | null;
  clientId?: string | null;
  tauxCommissionMaladie: string | number | null;
  tauxCommissionAssistance: string | number | null;
  contrats: number;
  prime: string | number;
  accessoires: ApiAccessoireTranche[];
  surprimesAge: ApiSurprimeAge[];
  clausesAjustement: ApiClauseAjustement[];
  territorialites: ApiTerritorialite[];
  tauxCouverture: ApiTauxCouverture[];
  garantiesCatalogue: ApiGarantieCatalogueLigne[];
  plafondFamilialDefaut: string | number | null;
  limiteAgeAdulteDefaut: number | null;
  limiteAgeEnfantDefaut: number | null;
  raisonSociale?: string | null;
  capitalSocial?: string | null;
  rccm?: string | null;
  statistique?: string | null;
  adresseSiege?: string | null;
  boitePostale?: string | null;
  ville?: string | null;
  telephone?: string | null;
  fax?: string | null;
  emailContact?: string | null;
  siteWeb?: string | null;
  banqueNom?: string | null;
  banqueNumeroCompte?: string | null;
  notePaiementDefaut?: string | null;
  piedDePageLegal?: string | null;
}

function n(v: string | number | null | undefined): number | null {
  return v === null || v === undefined ? null : toNumber(v);
}

function mapCompagnie(c: ApiCompagnie): Compagnie {
  return {
    id: c.id,
    nom: c.nom,
    pays: c.pays,
    code: c.code ?? null,
    prefixeNumeroPolice: c.prefixeNumeroPolice ?? null,
    codeCourtier: c.codeCourtier ?? null,
    compagnieMereId: c.compagnieMereId ?? null,
    compagnieMere: c.compagnieMere ?? null,
    agenceId: c.agenceId ?? null,
    agence: c.agence ?? null,
    logo: c.logo ?? null,
    clientId: c.clientId ?? null,
    tauxCommissionMaladie: n(c.tauxCommissionMaladie),
    tauxCommissionAssistance: n(c.tauxCommissionAssistance),
    contrats: c.contrats,
    prime: toNumber(c.prime),
    accessoires: c.accessoires.map((a) => ({ id: a.id, borneMin: toNumber(a.borneMin), borneMax: n(a.borneMax), montant: toNumber(a.montant) })),
    surprimesAge: c.surprimesAge.map((s) => ({ id: s.id, ageMin: s.ageMin, ageMax: s.ageMax, tauxPourcent: toNumber(s.tauxPourcent) })),
    clausesAjustement: c.clausesAjustement.map((cl) => ({ id: cl.id, spMin: toNumber(cl.spMin), spMax: n(cl.spMax), tauxAjustement: toNumber(cl.tauxAjustement), description: cl.description })),
    territorialites: c.territorialites.map((t) => ({ id: t.id, libelle: t.libelle })),
    tauxCouverture: c.tauxCouverture.map((t) => ({ id: t.id, tauxAmbulatoire: t.tauxAmbulatoire, tauxHospitalisation: t.tauxHospitalisation })),
    garantiesCatalogue: c.garantiesCatalogue.map((g) => ({
      id: g.id, branche: g.branche, categorie: g.categorie, libelle: g.libelle,
      tauxAssureDefaut: n(g.tauxAssureDefaut), tauxAyantsDroitDefaut: n(g.tauxAyantsDroitDefaut), plafondDefaut: g.plafondDefaut,
      tauxStructurePriveeDefaut: g.tauxStructurePriveeDefaut, tauxStructurePubliqueDefaut: g.tauxStructurePubliqueDefaut,
    })),
    plafondFamilialDefaut: n(c.plafondFamilialDefaut),
    limiteAgeAdulteDefaut: c.limiteAgeAdulteDefaut,
    limiteAgeEnfantDefaut: c.limiteAgeEnfantDefaut,
    raisonSociale: c.raisonSociale ?? null,
    capitalSocial: c.capitalSocial ?? null,
    rccm: c.rccm ?? null,
    statistique: c.statistique ?? null,
    adresseSiege: c.adresseSiege ?? null,
    boitePostale: c.boitePostale ?? null,
    ville: c.ville ?? null,
    telephone: c.telephone ?? null,
    fax: c.fax ?? null,
    emailContact: c.emailContact ?? null,
    siteWeb: c.siteWeb ?? null,
    banqueNom: c.banqueNom ?? null,
    banqueNumeroCompte: c.banqueNumeroCompte ?? null,
    notePaiementDefaut: c.notePaiementDefaut ?? null,
    piedDePageLegal: c.piedDePageLegal ?? null,
  };
}

// URL publique d'un logo uploadé (voir POST /compagnies/:id/logo, servie
// statiquement hors du préfixe /api — voir backend/src/main.ts).
export function compagnieLogoUrl(logo?: string | null): string | undefined {
  if (!logo) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/logos/${logo}`;
}

export async function getCompagnies(): Promise<Compagnie[]> {
  const data = await http.get<ApiCompagnie[]>("/compagnies");
  return data.map(mapCompagnie);
}

// Profils Auto-Gestion (souscripteurs auto-assureurs) — mêmes règles
// paramétrables qu'une vraie compagnie, voir écran Auto-Gestion.
export async function getCompagniesAutoGestion(): Promise<Compagnie[]> {
  const data = await http.get<ApiCompagnie[]>("/compagnies/auto-gestion");
  return data.map(mapCompagnie);
}

export async function createAutoGestionProfile(clientId: string): Promise<Compagnie> {
  const c = await http.post<ApiCompagnie>(`/compagnies/auto-gestion/${clientId}`);
  return mapCompagnie(c);
}

export interface CompagnieUpsertInput {
  nom: string;
  pays: string;
  code?: string;
  prefixeNumeroPolice?: string;
  codeCourtier?: string;
  compagnieMereId?: string;
  agenceId?: string;
  tauxCommissionMaladie?: number;
  tauxCommissionAssistance?: number;
  plafondFamilialDefaut?: number;
  limiteAgeAdulteDefaut?: number;
  limiteAgeEnfantDefaut?: number;
  raisonSociale?: string;
  capitalSocial?: string;
  rccm?: string;
  statistique?: string;
  adresseSiege?: string;
  boitePostale?: string;
  ville?: string;
  telephone?: string;
  fax?: string;
  emailContact?: string;
  siteWeb?: string;
  banqueNom?: string;
  banqueNumeroCompte?: string;
  notePaiementDefaut?: string;
  piedDePageLegal?: string;
}

export async function createCompagnie(payload: CompagnieUpsertInput): Promise<Compagnie> {
  const c = await http.post<ApiCompagnie>("/compagnies", payload);
  return mapCompagnie(c);
}

export async function updateCompagnie(id: string, payload: Partial<CompagnieUpsertInput>): Promise<Compagnie> {
  const c = await http.patch<ApiCompagnie>(`/compagnies/${id}`, payload);
  return mapCompagnie(c);
}

export async function deleteCompagnie(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/compagnies/${id}`);
}

export async function uploadCompagnieLogo(id: string, file: File): Promise<Compagnie> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("logo", file);
  const res = await fetch(`${API_URL}/compagnies/${id}/logo`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /compagnies/${id}/logo failed (${res.status}): ${await res.text()}`);
  return mapCompagnie(await res.json());
}

export async function deleteCompagnieLogo(id: string): Promise<Compagnie> {
  const c = await http.delete<ApiCompagnie>(`/compagnies/${id}/logo`);
  return mapCompagnie(c);
}

export async function replaceAccessoires(id: string, tranches: Omit<AccessoireTranche, "id">[]): Promise<Compagnie> {
  const c = await http.put<ApiCompagnie>(`/compagnies/${id}/accessoires`, { tranches });
  return mapCompagnie(c);
}

export async function replaceSurprimesAge(id: string, tranches: Omit<SurprimeAge, "id">[]): Promise<Compagnie> {
  const c = await http.put<ApiCompagnie>(`/compagnies/${id}/surprimes-age`, { tranches });
  return mapCompagnie(c);
}

export async function replaceClausesAjustement(id: string, clauses: Omit<ClauseAjustement, "id">[]): Promise<Compagnie> {
  const c = await http.put<ApiCompagnie>(`/compagnies/${id}/clauses-ajustement`, { clauses });
  return mapCompagnie(c);
}

export async function replaceTerritorialites(id: string, libelles: Omit<Territorialite, "id">[]): Promise<Compagnie> {
  const c = await http.put<ApiCompagnie>(`/compagnies/${id}/territorialites`, { libelles });
  return mapCompagnie(c);
}

export async function replaceTauxCouverture(id: string, taux: Omit<TauxCouverture, "id">[]): Promise<Compagnie> {
  const c = await http.put<ApiCompagnie>(`/compagnies/${id}/taux-couverture`, { taux });
  return mapCompagnie(c);
}

// Ne remplace qu'une seule branche à la fois (Maladie OU Assistance) —
// une compagnie a deux catalogues de garanties distincts.
export async function replaceGarantiesCatalogue(
  id: string, branche: "Maladie" | "Assistance", lignes: Omit<GarantieCatalogueLigne, "id" | "branche">[],
): Promise<Compagnie> {
  const c = await http.put<ApiCompagnie>(`/compagnies/${id}/garanties`, { branche, lignes });
  return mapCompagnie(c);
}
