import { http } from "@/lib/http";
import { toNumber } from "@/lib/decimal";
import type { Avenant } from "@/types/avenants";

interface ApiAvenantAssure {
  id: string;
  assureId: string;
  nom: string;
  prenom?: string | null;
  matricule?: string | null;
  typeAssure?: string | null;
  action: "Incorporation" | "Retrait";
}

interface ApiAvenant {
  id: string;
  contratId: string;
  type: string;
  description: string;
  primeAvant: string | number;
  primeApres: string | number;
  dateEffet: string;
  dateFin?: string | null;
  statut: string;
  contrat: { client: { nom: string } };
  avenantAssures?: ApiAvenantAssure[];
}

export function mapAvenant(a: ApiAvenant): Avenant {
  return {
    id: a.id,
    contrat: a.contratId,
    client: a.contrat.client.nom,
    type: a.type,
    description: a.description,
    primeAvant: toNumber(a.primeAvant),
    primeApres: toNumber(a.primeApres),
    dateEffet: a.dateEffet,
    statut: a.statut,
    personnes: a.avenantAssures,
  };
}

export async function getAvenants(): Promise<Avenant[]> {
  const data = await http.get<ApiAvenant[]>("/avenants");
  return data.map(mapAvenant);
}

// Portail client (2026-08) — voir demande utilisateur : page dédiée au
// contrat listant ses avenants. Endpoint cloisonné côté serveur (voir
// PortailClientController.avenantsDuContrat), contrairement à GET /avenants
// qui retourne tout sans filtre.
export async function getAvenantsDuContrat(contratId: string): Promise<Avenant[]> {
  const data = await http.get<ApiAvenant[]>(`/portail-client/contrats/${contratId}/avenants`);
  return data.map(mapAvenant);
}

export interface AvenantUpsertInput {
  contratId: string;
  type: string;
  description: string;
  primeAvant: number;
  primeApres: number;
  dateEffet: string;
  // Renouvellement uniquement : nouvelle date d'échéance du contrat.
  dateFin?: string;
  statut: "Brouillon" | "Validé" | "Appliqué" | "Relancé" | "Perdu" | "À renouveler";

  // ── Calcul de la prime — mêmes champs que la création de contrat ──────
  // (voir CalculPrimeSection.tsx / withComputedPrime côté serveur).
  nombreAssuresPrincipaux?: number;
  primeUnitaireAssurePrincipal?: number;
  nombreConjoints?: number;
  primeUnitaireConjoint?: number;
  nombreEnfants?: number;
  primeUnitaireEnfant?: number;
  nombreCouples?: number;
  primeUnitaireCouple?: number;
  tauxMinoMajoration?: number;
  tauxReductionCommerciale?: number;
  montantAccessoires?: number;
  tauxCommission?: number;

  // Renouvellement — indicateur de sinistralité.
  sinistralite?: string;

  // ── Résiliation ────────────────────────────────────────────────────────
  motif?: string;
  ristourne?: number;
  initiateur?: string;

  // ── Changement de Compagnie ─────────────────────────────────────────────
  compagnieAvantId?: string;
  compagnieApresId?: string;
}

export async function createAvenant(payload: AvenantUpsertInput): Promise<Avenant> {
  const a = await http.post<ApiAvenant>("/avenants", payload);
  return mapAvenant(a);
}

export async function updateAvenantStatut(id: string, statut: AvenantUpsertInput["statut"]): Promise<Avenant> {
  const a = await http.patch<ApiAvenant>(`/avenants/${id}`, { statut });
  return mapAvenant(a);
}

export async function appliquerAvenant(id: string): Promise<Avenant> {
  const a = await http.patch<ApiAvenant>(`/avenants/${id}/appliquer`);
  return mapAvenant(a);
}

export async function deleteAvenant(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/avenants/${id}`);
}
