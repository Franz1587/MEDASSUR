import { http, API_URL, postOffline, uploadFiles, type RnFilePart } from "./http";

// Miroir mobile de src/services/messagerie.service.ts (web).
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

// Envoi avec pièce jointe optionnelle — toujours multipart (comme le web),
// le backend (FileInterceptor) accepte un corps sans fichier.
//
// Mode hors-ligne (2026-09) : un message SANS pièce jointe est le cas
// d'usage typique en visite terrain sans réseau — celui-ci passe par
// postOffline() (JSON, pas multipart) et part automatiquement à la
// reconnexion (voir syncManager.ts) si l'envoi échoue par erreur réseau. Un
// message AVEC pièce jointe reste synchrone uniquement : mettre en file un
// fichier binaire demanderait de le conserver sur disque en plus du texte,
// hors du périmètre retenu pour cette première version du mode hors-ligne.
// Plusieurs pièces jointes en un envoi (2026-10) — voir demande
// utilisateur : "la sélection de plusieurs pièces jointes (de tout format
// de document et d'image)". Le serveur répartit les pièces en autant de
// messages (voir messagerie.service.ts envoyerMessage), le texte restant
// sur le premier.
export async function envoyerMessage(conversationId: string, contenu: string, fichiers: RnFilePart[] = []): Promise<Message> {
  if (fichiers.length === 0) {
    return postOffline<Message>(`/messagerie/conversations/${conversationId}/messages`, { contenu }, `Message : "${contenu.slice(0, 60)}"`);
  }
  return uploadFiles<Message>(`/messagerie/conversations/${conversationId}/messages`, fichiers, "fichiers", { contenu });
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
