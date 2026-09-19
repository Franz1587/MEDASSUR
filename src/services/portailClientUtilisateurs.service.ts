import { http } from "@/lib/http";

// Gestion des utilisateurs du portail client, PAR le client lui-même
// (2026-08) — voir backend/src/portail-client-utilisateurs. Distinct des
// comptes internes (src/services/users.service.ts, réservé à
// l'administration MedAssur).
export interface PortailUtilisateur {
  id: string;
  roleId: string;
  nom: string;
  email: string;
  initiales: string;
  modules: string[];
  telephone?: string | null;
  adresse?: string | null;
  photo?: string | null;
  clientId: string;
  createdAt: string;
}

export interface CreatePortailUtilisateurInput {
  nom: string;
  email: string;
  initiales: string;
  motDePasse: string;
  modules: string[];
  telephone?: string;
  adresse?: string;
}

export async function getPortailUtilisateurs(): Promise<PortailUtilisateur[]> {
  return http.get<PortailUtilisateur[]>("/portail-client/utilisateurs");
}

export async function createPortailUtilisateur(payload: CreatePortailUtilisateurInput): Promise<PortailUtilisateur> {
  return http.post<PortailUtilisateur>("/portail-client/utilisateurs", payload);
}

export async function updateModulesPortailUtilisateur(id: string, modules: string[]): Promise<PortailUtilisateur> {
  return http.patch<PortailUtilisateur>(`/portail-client/utilisateurs/${id}/modules`, { modules });
}

export async function deletePortailUtilisateur(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/portail-client/utilisateurs/${id}`);
}
