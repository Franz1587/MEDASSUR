import { http, API_URL } from "@/lib/http";
import type { Communication } from "@/types/communications";

export interface CommunicationsFiltre {
  canal?: string;
  destinataireType?: string;
  declencheur?: string;
}

export async function getCommunications(filtre?: CommunicationsFiltre): Promise<Communication[]> {
  const params = new URLSearchParams();
  if (filtre?.canal) params.set("canal", filtre.canal);
  if (filtre?.destinataireType) params.set("destinataireType", filtre.destinataireType);
  if (filtre?.declencheur) params.set("declencheur", filtre.declencheur);
  const qs = params.toString();
  return http.get<Communication[]>(`/communications${qs ? `?${qs}` : ""}`);
}

export interface EnvoyerCommunicationInput {
  canal: "Email" | "SMS" | "WhatsApp";
  destinataireType: "Prestataire" | "Client" | "AssureSante" | "Prospect" | "Libre";
  destinataireId?: string;
  destinataireNom: string;
  destinataireContact: string;
  objet?: string;
  contenu: string;
}

export async function envoyerCommunication(payload: EnvoyerCommunicationInput): Promise<Communication> {
  return http.post<Communication>("/communications", payload);
}

export async function enregistrerRetourCommunication(id: string, retour: string): Promise<Communication> {
  return http.patch<Communication>(`/communications/${id}/retour`, { retour });
}

// URL publique d'une pièce jointe simulée (voir backend/uploads/communications/),
// servie statiquement hors du préfixe /api — même pattern que prospectLogoUrl.
export function pieceJointeCommunicationUrl(pieceJointe?: string | null): string | undefined {
  if (!pieceJointe) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/communications/${pieceJointe}`;
}
