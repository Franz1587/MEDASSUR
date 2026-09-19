import { http } from "@/lib/http";
import type { LettrageClient, LettrageFournisseur } from "@/types/lettrage";

// Lettrage interne — comptes clients/fournisseurs de la société connectée
// (cloisonné automatiquement par societeId, voir TenantContext). Voir
// backend/src/lettrage/.
export function getLettrageClients(): Promise<LettrageClient[]> {
  return http.get("/lettrage/clients");
}

export function getLettrageFournisseurs(): Promise<LettrageFournisseur[]> {
  return http.get("/lettrage/fournisseurs");
}
