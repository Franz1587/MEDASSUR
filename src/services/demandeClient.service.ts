import { http, uploadFile, ecritureHorsLigne } from "@/lib/http";
import type { CreateDemandeClientInput, DecisionDemandeClientInput, DemandeClient, DemandeClientBeneficiaire } from "@/types/demandeClient";

interface ApiDemandeClient extends Omit<DemandeClient, "contratReference" | "clientNom" | "demandeurNom" | "assureRetraitNom"> {
  contrat?: { id: string; numeroPolice?: string | null; client?: { nom: string } };
  demandeur?: { nom: string };
  assureRetrait?: { nom: string; prenom?: string | null };
}

function mapDemande(d: ApiDemandeClient): DemandeClient {
  return {
    ...d,
    contratReference: d.contrat?.numeroPolice ?? d.contrat?.id,
    clientNom: d.contrat?.client?.nom,
    demandeurNom: d.demandeur?.nom,
    assureRetraitNom: d.assureRetrait ? `${d.assureRetrait.nom} ${d.assureRetrait.prenom ?? ""}`.trim() : undefined,
  };
}

// ── Côté portail client ────────────────────────────────────────────────
// Mode hors-ligne (2026-09) — voir lib/http.ts (ecritureHorsLigne). Sans
// réseau, la demande est mise en file et part seule à la reconnexion ; la
// fonction lève QueuedOfflineError au lieu de renvoyer la demande créée —
// voir l'écran appelant pour la distinction avec une vraie erreur.
export async function createDemandeClient(payload: CreateDemandeClientInput): Promise<DemandeClient> {
  const data = await ecritureHorsLigne<ApiDemandeClient>("/demandes-client", payload, `Demande client (${payload.type})`);
  return mapDemande(data);
}

export async function getMesDemandesClient(): Promise<DemandeClient[]> {
  const data = await http.get<ApiDemandeClient[]>("/demandes-client/mine");
  return data.map(mapDemande);
}

// Photo d'un bénéficiaire (2026-08) — voir demande utilisateur : "rendre
// possible l'ajout des photos pour rendre possible l'édition des cartes
// côté assurance". Envoyée une fois le bénéficiaire créé (id réel connu).
export async function uploadPhotoBeneficiaireDemande(beneficiaireId: string, file: File): Promise<DemandeClientBeneficiaire> {
  return uploadFile<DemandeClientBeneficiaire>(`/demandes-client/beneficiaires/${beneficiaireId}/photo`, file, "photo");
}

// ── Côté interne (gestionnaire) ─────────────────────────────────────────
export async function getDemandesClient(statut?: string): Promise<DemandeClient[]> {
  const qs = statut ? `?statut=${encodeURIComponent(statut)}` : "";
  const data = await http.get<ApiDemandeClient[]>(`/demandes-client${qs}`);
  return data.map(mapDemande);
}

// Prise en main d'un dossier (2026-09) — voir demande utilisateur :
// "étendre le fait de prendre en main un dossier aux agents de saisie,
// gestionnaire sinistre et gestionnaires production".
export async function prendreDemandeClient(id: string): Promise<DemandeClient> {
  const data = await http.patch<ApiDemandeClient>(`/demandes-client/${id}/prendre`);
  return mapDemande(data);
}

export async function trancherDemandeClient(id: string, payload: DecisionDemandeClientInput): Promise<DemandeClient> {
  const data = await http.patch<ApiDemandeClient>(`/demandes-client/${id}/decision`, payload);
  return mapDemande(data);
}
