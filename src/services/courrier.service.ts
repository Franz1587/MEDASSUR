import { http } from "@/lib/http";

// Courrier Maladie (2026-08) — éditeur façon Word, voir demande utilisateur.
export interface CourrierType {
  id: string;
  libelle: string;
  corpsModele: string;
  actif: boolean;
}

export interface CourrierTypeUpsertInput {
  libelle: string;
  corpsModele: string;
  actif?: boolean;
}

export async function getCourrierTypes(): Promise<CourrierType[]> {
  return http.get<CourrierType[]>("/modeles-courrier");
}

export async function createCourrierType(payload: CourrierTypeUpsertInput): Promise<CourrierType> {
  return http.post<CourrierType>("/modeles-courrier", payload);
}

export async function updateCourrierType(id: string, payload: Partial<CourrierTypeUpsertInput>): Promise<CourrierType> {
  return http.patch<CourrierType>(`/modeles-courrier/${id}`, payload);
}

export async function deleteCourrierType(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/modeles-courrier/${id}`);
}

export interface Courrier {
  id: string;
  reference: string;
  typeId?: string | null;
  objet: string;
  destinataireNom: string;
  destinataireAdresse?: string | null;
  clientId?: string | null;
  prestataireId?: string | null;
  assureId?: string | null;
  corps: string;
  auteurId: string;
  dateCreation: string;
  statut: string;
  type?: { id: string; libelle: string } | null;
  auteur: { id: string; nom: string; initiales: string };
  client?: { id: string; nom: string } | null;
  prestataire?: { id: string; nom: string } | null;
  assure?: { id: string; nom: string; prenom?: string | null } | null;
}

export interface CourrierUpsertInput {
  typeId?: string;
  objet: string;
  destinataireNom: string;
  destinataireAdresse?: string;
  clientId?: string;
  prestataireId?: string;
  assureId?: string;
  corps: string;
  dateCreation: string;
}

export interface CourrierFiltres {
  reference?: string;
  typeId?: string;
  destinataire?: string;
  auteurId?: string;
  du?: string;
  au?: string;
}

export async function getCourriers(filtres?: CourrierFiltres): Promise<Courrier[]> {
  const params = new URLSearchParams();
  if (filtres?.reference) params.set("reference", filtres.reference);
  if (filtres?.typeId) params.set("typeId", filtres.typeId);
  if (filtres?.destinataire) params.set("destinataire", filtres.destinataire);
  if (filtres?.auteurId) params.set("auteurId", filtres.auteurId);
  if (filtres?.du) params.set("du", filtres.du);
  if (filtres?.au) params.set("au", filtres.au);
  const qs = params.toString();
  return http.get<Courrier[]>(`/courrier${qs ? `?${qs}` : ""}`);
}

export async function createCourrier(payload: CourrierUpsertInput): Promise<Courrier> {
  return http.post<Courrier>("/courrier", payload);
}
