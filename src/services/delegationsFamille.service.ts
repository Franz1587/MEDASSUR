import { http } from "@/lib/http";
import type { View } from "@/layout/navConfig";

// Délégation d'accès famille (2026-08) — voir backend/src/portail-membre/
// delegations-famille.service.ts. Réservé au compte de l'assuré principal
// racine (jamais un ayant droit délégué, vérifié côté serveur).

export interface DelegationCompte {
  id: string;
  roleId: string;
  nom: string;
  email: string;
  initiales: string;
  modules: string[];
  createdAt: string;
}

export interface DelegationMembre {
  id: string;
  nom: string;
  prenom: string | null;
  typeAssure: string | null;
  matricule: string;
  telephone: string | null;
  email: string | null;
  compte: DelegationCompte | null;
}

export type CanalDelegation = "matricule" | "email" | "telephone";

export interface GrantDelegationInput {
  identifiantType: CanalDelegation;
  identifiantValeur?: string;
  motDePasse: string;
  modules: View[];
}

export async function getDelegations(): Promise<DelegationMembre[]> {
  return http.get<DelegationMembre[]>("/portail-membre/delegations");
}

export async function getModulesDelegables(): Promise<View[]> {
  return http.get<View[]>("/portail-membre/delegations/modules-disponibles");
}

export async function accorderDelegation(assureId: string, payload: GrantDelegationInput): Promise<DelegationCompte> {
  return http.post<DelegationCompte>(`/portail-membre/delegations/${assureId}`, payload);
}

export async function modifierModulesDelegation(assureId: string, modules: View[]): Promise<DelegationCompte> {
  return http.patch<DelegationCompte>(`/portail-membre/delegations/${assureId}/modules`, { modules });
}

export async function revoquerDelegation(assureId: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/portail-membre/delegations/${assureId}`);
}
