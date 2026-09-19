import { http } from "@/lib/http";

// Vérification publique d'un document (2026-09) — voir demande utilisateur :
// "une signature électronique unique (QR code) pour chaque document créé
// ou édité dans l'application... une authentification infaillible de
// chaque prestation faite". Consommé par VerificationPage (route publique
// /verifier/:id, jamais connectée) — voir backend VerificationPubliqueController.

export interface DetailStatutActuel { label: string; valeur: string }
export interface StatutActuelDocument { reference: string; statut: string; details: DetailStatutActuel[] }

export interface SignatureVerifiee {
  id: string;
  documentType: string;
  documentRef: string;
  acteurNom: string;
  acteurRole: string;
  origine: string;
  dateSignature: string;
  statutActuel: StatutActuelDocument | null;
}

export async function verifierDocument(id: string): Promise<SignatureVerifiee> {
  return http.get<SignatureVerifiee>(`/verification/${id}`);
}
