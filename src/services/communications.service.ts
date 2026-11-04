import { http, API_URL, getAccessToken, invaliderCache, runSilently } from "@/lib/http";
import type { Communication, CompteursCommunications, DossierCommunication, SignatureCommunication } from "@/types/communications";

export interface CommunicationsFiltre {
  canal?: string;
  destinataireType?: string;
  declencheur?: string;
  dossier?: DossierCommunication;
  q?: string;
}

export async function getCommunicationsConfig(): Promise<{ smsWhatsappActif: boolean; emailActif: boolean }> {
  return http.get<{ smsWhatsappActif: boolean; emailActif: boolean }>("/communications/config");
}

// Toujours relu du serveur (pas de cache) : une boîte mail doit refléter les nouveaux messages.
export async function getCommunications(filtre?: CommunicationsFiltre, silencieux = false): Promise<Communication[]> {
  const params = new URLSearchParams();
  Object.entries(filtre ?? {}).forEach(([k, v]) => { if (v) params.set(k, String(v)); });
  const qs = params.toString();
  invaliderCache("/communications");
  const appel = () => http.get<Communication[]>(`/communications${qs ? `?${qs}` : ""}`);
  return silencieux ? runSilently(appel) : appel();
}

export async function getCompteursCommunications(): Promise<CompteursCommunications> {
  invaliderCache("/communications");
  return runSilently(() => http.get<CompteursCommunications>("/communications/compteurs"));
}

export interface EnvoyerCommunicationInput {
  canal: "Email" | "SMS" | "WhatsApp";
  destinataireType: "Prestataire" | "Client" | "AssureSante" | "Prospect" | "Libre";
  destinataireId?: string;
  destinataireNom: string;
  destinataireContact: string;
  cc?: string;
  objet?: string;
  contenu: string;
  contenuHtml?: string;
  piecesJointesExistantes?: string[];
  brouillonId?: string;
}

async function envoyerFormulaire<T>(path: string, method: "POST" | "PATCH", input: Partial<EnvoyerCommunicationInput>, fichiers: File[]): Promise<T> {
  const form = new FormData();
  Object.entries(input).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    form.append(k, k === "piecesJointesExistantes" ? JSON.stringify(v) : String(v));
  });
  fichiers.forEach((f) => form.append("fichiers", f));
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  invaliderCache("/communications");
  if (!res.ok) {
    const corps = await res.text();
    let message = corps;
    try { const j = JSON.parse(corps); message = Array.isArray(j.message) ? j.message.join(", ") : j.message ?? corps; } catch { /* texte brut */ }
    throw new Error(message || `Échec (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function envoyerCommunication(input: EnvoyerCommunicationInput, fichiers: File[] = []): Promise<Communication> {
  return envoyerFormulaire<Communication>("/communications", "POST", input, fichiers);
}

export function enregistrerBrouillon(input: Partial<EnvoyerCommunicationInput>, fichiers: File[] = [], id?: string): Promise<Communication> {
  const { brouillonId: _ignore, ...reste } = input;
  return envoyerFormulaire<Communication>(id ? `/communications/brouillons/${id}` : "/communications/brouillons", id ? "PATCH" : "POST", reste, fichiers);
}

export function majCommunication(id: string, maj: Partial<Pick<Communication, "lu" | "archive" | "supprime" | "suivi">>): Promise<Communication> {
  return http.patch<Communication>(`/communications/${id}`, maj);
}

export function supprimerCommunication(id: string): Promise<{ ok: boolean }> {
  return http.delete<{ ok: boolean }>(`/communications/${id}`);
}

export async function enregistrerRetourCommunication(id: string, retour: string): Promise<Communication> {
  return http.patch<Communication>(`/communications/${id}/retour`, { retour });
}

export function getSignature(): Promise<SignatureCommunication> {
  invaliderCache("/communications");
  return http.get<SignatureCommunication>("/communications/signature");
}

export function enregistrerSignature(s: SignatureCommunication): Promise<SignatureCommunication> {
  return http.put<SignatureCommunication>("/communications/signature", s);
}

// URL publique d'une pièce jointe (backend/uploads/communications/), servie
// statiquement hors du préfixe /api — même pattern que prospectLogoUrl.
export function pieceJointeCommunicationUrl(pieceJointe?: string | null): string | undefined {
  if (!pieceJointe) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/communications/${encodeURIComponent(pieceJointe)}`;
}

// Nom affiché : sans le préfixe aléatoire « a1b2c3- » ajouté au stockage.
export function nomPieceJointe(fichier: string): string {
  return fichier.replace(/^[0-9a-f]{6}-/, "");
}
