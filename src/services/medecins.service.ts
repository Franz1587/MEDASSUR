import { http } from "@/lib/http";

// Professionnel de santé (2026-08) — voir demande utilisateur : "il faut à
// présent rendre possible l'ajout d'un médecin et sa spécialité dans le
// prestataire... créer un onglet professionnel de santé [rubrique
// Système]... créer des médecins, puis les lier à une clinique, hôpital...
// car un même médecin peut faire des prestations dans plusieurs structures
// médicales." Modèle séparé de Prestataire (voir schema.prisma Medecin).
export interface MedecinStructure {
  id: string;
  nom: string;
  type: string;
  ville: string;
}

export interface Medecin {
  id: string;
  nom: string;
  prenom: string | null;
  titre: string | null;
  specialite: string | null;
  // Code praticien = numéro à l'ordre des médecins (2026-08).
  codePraticien: string | null;
  telephone: string | null;
  email: string | null;
  actif: boolean;
  createdAt: string;
  structures: MedecinStructure[];
}

interface ApiMedecin extends Omit<Medecin, "structures"> {
  structures: { prestataire: MedecinStructure }[];
}

function mapMedecin(m: ApiMedecin): Medecin {
  return { ...m, structures: m.structures.map((s) => s.prestataire) };
}

export async function getMedecins(filtres?: { q?: string; prestataireId?: string }): Promise<Medecin[]> {
  const params = new URLSearchParams();
  if (filtres?.q) params.set("q", filtres.q);
  if (filtres?.prestataireId) params.set("prestataireId", filtres.prestataireId);
  const qs = params.toString();
  const data = await http.get<ApiMedecin[]>(`/medecins${qs ? `?${qs}` : ""}`);
  return data.map(mapMedecin);
}

export async function getMedecin(id: string): Promise<Medecin> {
  const data = await http.get<ApiMedecin>(`/medecins/${id}`);
  return mapMedecin(data);
}

export interface MedecinUpsertInput {
  nom: string;
  prenom?: string;
  titre?: string;
  specialite?: string;
  codePraticien?: string;
  telephone?: string;
  email?: string;
  actif?: boolean;
  prestataireIds?: string[];
}

export async function createMedecin(payload: MedecinUpsertInput): Promise<Medecin> {
  const data = await http.post<ApiMedecin>("/medecins", payload);
  return mapMedecin(data);
}

export async function updateMedecin(id: string, payload: Partial<MedecinUpsertInput>): Promise<Medecin> {
  const data = await http.patch<ApiMedecin>(`/medecins/${id}`, payload);
  return mapMedecin(data);
}

export async function supprimerMedecin(id: string): Promise<void> {
  await http.delete(`/medecins/${id}`);
}

export async function lierStructure(medecinId: string, prestataireId: string): Promise<Medecin> {
  const data = await http.post<ApiMedecin>(`/medecins/${medecinId}/structures/${prestataireId}`);
  return mapMedecin(data);
}

export async function delierStructure(medecinId: string, prestataireId: string): Promise<Medecin> {
  const data = await http.delete<ApiMedecin>(`/medecins/${medecinId}/structures/${prestataireId}`);
  return mapMedecin(data);
}
