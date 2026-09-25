import { http } from "@/lib/http";

// Rapports de clôture générés par Ariana (2026-09) — voir demande
// utilisateur : "il faut aussi que Ariana fasse un rapport lorsqu'elle a
// pu gérer une demande et que l'assuré repart satisfait." Écran interne de
// supervision uniquement (jamais un portail externe) — voir
// backend/src/messagerie/rapports-ia.controller.ts.
export interface RapportConversationIA {
  id: string;
  conversationId: string;
  demandeurNom: string;
  objet: string;
  resume: string;
  lu: boolean;
  createdAt: string;
}

export function getRapportsIa(lu?: boolean): Promise<RapportConversationIA[]> {
  const qs = lu !== undefined ? `?lu=${lu}` : "";
  return http.get<RapportConversationIA[]>(`/rapports-ia${qs}`);
}

export function marquerRapportIaLu(id: string, lu = true): Promise<RapportConversationIA> {
  return http.patch<RapportConversationIA>(`/rapports-ia/${id}/lu`, { lu });
}
