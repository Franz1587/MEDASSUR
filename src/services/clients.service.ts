import { http, API_URL, getAccessToken, downloadFile, uploadFile } from "@/lib/http";
import type { Client, ClientPortfolio } from "@/types/clients";

// Import en masse (2026-08) — voir demande utilisateur : "créer 50, 100,
// 1000 contrats/souscripteurs" impraticable un par un. Même pattern que
// ContratsService côté backend (modèle .xlsx, aperçu dry-run, confirmation).
export interface ImportClientRow {
  nom: string;
  type?: string; pays?: string; contact?: string; tel?: string; email?: string;
  ville?: string; adresse?: string; boitePostale?: string;
  categorieMorale?: string; formeJuridique?: string; rccm?: string; nif?: string; secteurActivite?: string;
  representantNom?: string; representantFonction?: string; representantTel?: string; representantEmail?: string;
  prenom?: string; dateNaissance?: string; lieuNaissance?: string; sexe?: string; nationalite?: string;
  profession?: string; pieceIdentiteType?: string; pieceIdentiteNumero?: string;
}

export function telechargerModeleImportClients(): Promise<void> {
  return downloadFile("/clients/modele-import", "modele-import-souscripteurs.xlsx");
}

export function apercuImportClients(file: File): Promise<{ lignes: ImportClientRow[]; rejets: { ligne: number; motif: string }[] }> {
  return uploadFile(`/clients/import/apercu`, file);
}

export function confirmerImportClients(rows: ImportClientRow[]): Promise<{ crees: number; rejets: { ligne: number; motif: string }[] }> {
  return http.post(`/clients/import`, { rows });
}

// URL publique d'un logo de souscripteur uploadé (voir POST
// /clients/:id/logo), servie statiquement hors du préfixe /api — même
// pattern que compagnieLogoUrl.
export function clientLogoUrl(logo?: string | null): string | undefined {
  if (!logo) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/logos-clients/${logo}`;
}

export interface ClientUpsertInput {
  nom: string;
  type: "Entreprise" | "Particulier";
  pays: string;
  contact: string;
  tel: string;
  email: string;
  statut: "Actif" | "Inactif";

  ville?: string;
  adresse?: string;
  boitePostale?: string;
  telSecondaire?: string;

  // Personne morale
  categorieMorale?: Client["categorieMorale"];
  formeJuridique?: string;
  rccm?: string;
  nif?: string;
  secteurActivite?: string;
  effectif?: number;
  representantNom?: string;
  representantFonction?: string;
  representantTel?: string;
  representantEmail?: string;

  // Personne physique
  prenom?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  sexe?: Client["sexe"];
  nationalite?: string;
  situationMatrimoniale?: Client["situationMatrimoniale"];
  profession?: string;
  employeur?: string;
  pieceIdentiteType?: Client["pieceIdentiteType"];
  pieceIdentiteNumero?: string;
}

export async function getClients(compagnieId?: string): Promise<Client[]> {
  return http.get<Client[]>(compagnieId ? `/clients?compagnieId=${encodeURIComponent(compagnieId)}` : "/clients");
}

export async function getClientPortfolio(clientId: string): Promise<ClientPortfolio> {
  return http.get<ClientPortfolio>(`/clients/${clientId}/portfolio`);
}

export async function createClient(payload: ClientUpsertInput): Promise<Client> {
  return http.post<Client>("/clients", payload);
}

export async function updateClient(clientId: string, payload: Partial<ClientUpsertInput>): Promise<Client> {
  return http.patch<Client>(`/clients/${clientId}`, payload);
}

export async function deleteClient(clientId: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/clients/${clientId}`);
}

export async function uploadClientLogo(clientId: string, file: File): Promise<Client> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("logo", file);
  const res = await fetch(`${API_URL}/clients/${clientId}/logo`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /clients/${clientId}/logo failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function deleteClientLogo(clientId: string): Promise<Client> {
  return http.delete<Client>(`/clients/${clientId}/logo`);
}
