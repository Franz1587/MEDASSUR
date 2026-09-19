import { http, API_URL, getAccessToken } from "@/lib/http";

// Messagerie (2026-08) — voir demande utilisateur : "il faut créer pour tous
// les acteurs ou utilisateur un onglet de Messagerie permettant, aux
// assurés, au client et aux prestataire de discuter directement avec
// l'assurance... pouvoir envoyer des pièces jointes... garder l'historique
// des ses échanges et donner systématiquement un objet dès l'ouverture."
// UN seul service, consommé par le composant universel Messagerie.tsx pour
// tous les shells (interne ET tous les portails) — miroir du backend
// MessagerieService (estRoleInterne y fait le même travail de branchement).
export interface Conversation {
  id: string;
  objet: string;
  demandeurId: string;
  demandeurRole: string;
  canal: string;
  statut: string;
  assigneAId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  auteurId?: string | null;
  auteurType: string;
  contenu: string;
  pieceJointe?: string | null;
  dateEnvoi: string;
  lu: boolean;
}

export function getConversations(): Promise<Conversation[]> {
  return http.get<Conversation[]>("/messagerie/conversations");
}

export function getNonLus(): Promise<number> {
  return http.get<{ count: number }>("/messagerie/conversations/non-lus").then((r) => r.count);
}

export function creerConversation(objet: string, canal: "IA" | "Humain", message: string): Promise<Conversation> {
  return http.post<Conversation>("/messagerie/conversations", { objet, canal, message });
}

export function getMessages(conversationId: string): Promise<Message[]> {
  return http.get<Message[]>(`/messagerie/conversations/${conversationId}/messages`);
}

// Envoi avec pièce jointe optionnelle (2026-08) — multipart comme
// uploadFichierAccordPrealable, jamais le helper http (pas de multipart).
export async function envoyerMessage(conversationId: string, contenu: string, fichier?: File): Promise<Message> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("contenu", contenu);
  if (fichier) form.append("fichier", fichier);
  const res = await fetch(`${API_URL}/messagerie/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /messagerie/conversations/${conversationId}/messages failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<Message>;
}

export function prendreConversation(conversationId: string): Promise<Conversation> {
  return http.patch<Conversation>(`/messagerie/conversations/${conversationId}/prendre`);
}

export function changerStatutConversation(conversationId: string, statut: string): Promise<Conversation> {
  return http.patch<Conversation>(`/messagerie/conversations/${conversationId}/statut`, { statut });
}

export function marquerConversationLue(conversationId: string): Promise<void> {
  return http.patch<{ ok: true }>(`/messagerie/conversations/${conversationId}/lus`).then(() => undefined);
}

export function urlPieceJointeMessagerie(fichier: string): string {
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/messagerie/${fichier}`;
}
