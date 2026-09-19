import { http } from "@/lib/http";

// Encaissements de prime (2026-08) — saisie manuelle des paiements reçus des
// souscripteurs, source du Bordereau d'Encaissement. Voir
// backend/src/encaissements.
export interface EncaissementPrime {
  id: string;
  contratId: string;
  montant: number;
  dateEncaissement: string;
  modePaiement: string | null;
  referencePaiement: string | null;
  note: string | null;
  createdAt: string;
  contrat: {
    id: string;
    numeroPolice: string | null;
    client: { id: string; nom: string };
    compagnie: { id: string; nom: string };
  };
}

export interface CreateEncaissementInput {
  contratId: string;
  montant: number;
  dateEncaissement: string;
  modePaiement?: string;
  referencePaiement?: string;
  note?: string;
}

export async function getEncaissements(contratId?: string): Promise<EncaissementPrime[]> {
  const qs = contratId ? `?contratId=${encodeURIComponent(contratId)}` : "";
  const data = await http.get<Array<Omit<EncaissementPrime, "montant"> & { montant: string | number }>>(`/encaissements${qs}`);
  return data.map((e) => ({ ...e, montant: Number(e.montant) }));
}

export function createEncaissement(input: CreateEncaissementInput): Promise<EncaissementPrime> {
  return http.post<EncaissementPrime>("/encaissements", input);
}

export function deleteEncaissement(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/encaissements/${id}`);
}
