import { http, API_URL, getAccessToken } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Prospect, ProspectDetail, ProspectHistoriqueEntry, SuggestionsCommissionProspect, StatistiquesProspection } from "@/types/crm";

interface ApiProspect {
  id: string;
  nom: string;
  type: string;
  source: string;
  etape: string;
  valeurEstimee: string | number;
  commercial: string;
  dernierContact: string;
  gestionnaireId?: string | null;
  logo?: string | null;
  createdAt: string;
  contactNom?: string | null;
  contactFonction?: string | null;
  contactTelephone?: string | null;
  contactEmail?: string | null;
  typeContrat?: string | null;
  clientId?: string | null;
  client?: { id: string; nom: string } | null;
}

interface ApiProspectHistorique {
  id: string;
  date: string;
  auteur?: { nom: string } | null;
  type: string;
  etapeAvant?: string | null;
  etapeApres?: string | null;
  description: string;
}

interface ApiProspectDetail extends ApiProspect {
  historique: ApiProspectHistorique[];
}

function mapProspect(p: ApiProspect): Prospect {
  return {
    ...p, valeurEstimee: toNumber(p.valeurEstimee), gestionnaireId: p.gestionnaireId ?? null, logo: p.logo ?? null,
    contactNom: p.contactNom ?? undefined, contactFonction: p.contactFonction ?? undefined,
    contactTelephone: p.contactTelephone ?? undefined, contactEmail: p.contactEmail ?? undefined,
    typeContrat: (p.typeContrat as Prospect["typeContrat"]) ?? undefined,
    clientId: p.clientId ?? p.client?.id ?? undefined, clientNom: p.client?.nom ?? undefined,
  };
}

function mapHistorique(h: ApiProspectHistorique): ProspectHistoriqueEntry {
  return {
    id: h.id, date: h.date, auteurNom: h.auteur?.nom ?? undefined, type: h.type as ProspectHistoriqueEntry["type"],
    etapeAvant: h.etapeAvant ?? undefined, etapeApres: h.etapeApres ?? undefined, description: h.description,
  };
}

function mapProspectDetail(p: ApiProspectDetail): ProspectDetail {
  return { ...mapProspect(p), historique: p.historique.map(mapHistorique) };
}

// URL publique d'un logo de prospect uploadé (voir POST
// /crm/prospects/:id/logo), servie statiquement hors du préfixe /api —
// même pattern que compagnieLogoUrl.
export function prospectLogoUrl(logo?: string | null): string | undefined {
  if (!logo) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/logos-prospects/${logo}`;
}

export interface ProspectUpsertInput {
  nom: string;
  type: "Entreprise" | "Particulier";
  source: string;
  etape: "Nouveau" | "Qualifié" | "Proposition envoyée" | "Négociation" | "Gagné" | "Perdu";
  valeurEstimee: number;
  commercial: string;
  dernierContact: string;
  contactNom?: string;
  contactFonction?: string;
  contactTelephone?: string;
  contactEmail?: string;
  typeContrat?: "MaladieEtAssistance" | "MaladieSeule";
}

export async function getProspects(): Promise<Prospect[]> {
  const data = await http.get<ApiProspect[]>("/crm/prospects");
  return data.map(mapProspect);
}

export async function getProspect(id: string): Promise<ProspectDetail> {
  const data = await http.get<ApiProspectDetail>(`/crm/prospects/${id}`);
  return mapProspectDetail(data);
}

export async function createProspect(payload: ProspectUpsertInput): Promise<Prospect> {
  const p = await http.post<ApiProspect>("/crm/prospects", payload);
  return mapProspect(p);
}

export async function updateProspect(id: string, payload: Partial<ProspectUpsertInput>): Promise<Prospect> {
  const p = await http.patch<ApiProspect>(`/crm/prospects/${id}`, payload);
  return mapProspect(p);
}

export async function deleteProspect(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/crm/prospects/${id}`);
}

// Historique / évolution du dossier (2026-08) — voir demande utilisateur :
// "l'application doit permettre de renseigner les informations sur
// l'évolution d'un dossier de prospection".
export async function ajouterNoteProspect(id: string, description: string): Promise<ProspectDetail> {
  const data = await http.post<ApiProspectDetail>(`/crm/prospects/${id}/notes`, { description });
  return mapProspectDetail(data);
}

// Conversion en client (2026-08) — voir demande utilisateur : "lesquels
// sont devenus des clients".
export async function lierClientProspect(id: string, clientId: string): Promise<ProspectDetail> {
  const data = await http.patch<ApiProspectDetail>(`/crm/prospects/${id}/lier-client`, { clientId });
  return mapProspectDetail(data);
}

// Suggestion de commission par compagnie (2026-08) — voir demande
// utilisateur : "l'application doit pouvoir calculer la commission
// possible pour chaque compagnie en fonction des taux existants. Faire
// une analyse et suggérer."
export async function getSuggestionsCommission(id: string): Promise<SuggestionsCommissionProspect> {
  return http.get<SuggestionsCommissionProspect>(`/crm/prospects/${id}/suggestion-commission`);
}

// Statistiques d'évolution par exercice (2026-08) — voir demande
// utilisateur : "l'application doit pouvoir faire analyse statistique sur
// l'évolution de prospects".
export async function getStatistiquesProspection(exercice?: string): Promise<StatistiquesProspection> {
  const qs = exercice ? `?exercice=${encodeURIComponent(exercice)}` : "";
  return http.get<StatistiquesProspection>(`/crm/prospects/statistiques${qs}`);
}

export async function uploadProspectLogo(id: string, file: File): Promise<Prospect> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("logo", file);
  const res = await fetch(`${API_URL}/crm/prospects/${id}/logo`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /crm/prospects/${id}/logo failed (${res.status}): ${await res.text()}`);
  return mapProspect(await res.json());
}

export async function deleteProspectLogo(id: string): Promise<Prospect> {
  const p = await http.delete<ApiProspect>(`/crm/prospects/${id}/logo`);
  return mapProspect(p);
}

/** Derived client-side from each prospect's own pipeline `etape`. */
export async function getCrmKanban(): Promise<Record<string, string[]>> {
  const prospects = await getProspects();
  const columns: Record<string, string[]> = {};
  for (const p of prospects) {
    (columns[p.etape] ??= []).push(p.id);
  }
  return columns;
}
