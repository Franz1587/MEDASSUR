import { http } from "@/lib/http";

export type CanalEnvoiAcces = "WhatsApp" | "SMS" | "WhatsApp+SMS";

export interface ResultatGenerationCompte {
  assureId: string;
  nom: string;
  matricule: string;
  identifiant: string;
  telephone: string | null;
  canal: string;
  statutEnvoi: string;
  messageSimule: string;
}

// Génère (ou régénère) les accès mobile des assurés principaux sélectionnés
// — voir ComptesMobileService côté backend. Aucun fournisseur SMS/WhatsApp
// n'est branché : chaque résultat porte le message qui aurait été envoyé
// (statutEnvoi "Simulé"), à relayer manuellement pour l'instant (voir
// GenerationComptesMobileModal.tsx, bouton Copier).
export async function genererComptesMobile(payload: {
  contratId: string;
  assureIds: string[];
  canal: CanalEnvoiAcces;
}): Promise<ResultatGenerationCompte[]> {
  return http.post<ResultatGenerationCompte[]>("/comptes-mobile/generer", payload);
}
