import { http, uploadFile, API_URL } from "@/lib/http";
import { roles, type RoleId } from "@/auth/roles";
import type { UserAccount, RoleSummary } from "@/types/admin";
import type { JetonSignatureQr } from "./maSignature.service";

export interface CreateUserInput {
  nom: string;
  email: string;
  initiales: string;
  roleId: RoleId;
  modules?: string[];
  telephone?: string;
  adresse?: string;
  // Agence de rattachement (2026-09) — voir services/agences.service.ts.
  agenceId?: string;
}

export interface UpdateUserInput {
  nom?: string;
  email?: string;
  initiales?: string;
  roleId?: RoleId;
  telephone?: string;
  adresse?: string;
  agenceId?: string;
}

// URL publique d'une photo de profil uploadée (voir POST /users/:id/photo,
// servie statiquement hors du préfixe /api — voir backend/src/main.ts),
// même principe que compagnieLogoUrl (src/services/compagnies.service.ts).
export function userPhotoUrl(photo?: string | null): string | undefined {
  if (!photo) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/photos-users/${photo}`;
}

export async function getUsers(): Promise<UserAccount[]> {
  return http.get<UserAccount[]>("/users");
}

export async function getUser(id: string): Promise<UserAccount> {
  return http.get<UserAccount>(`/users/${id}`);
}

export async function createUser(payload: CreateUserInput): Promise<UserAccount> {
  return http.post<UserAccount>("/users", payload);
}

export async function updateUser(id: string, payload: UpdateUserInput): Promise<UserAccount> {
  return http.patch<UserAccount>(`/users/${id}`, payload);
}

export async function updateUserModules(id: string, modules: string[]): Promise<UserAccount> {
  return http.patch<UserAccount>(`/users/${id}/modules`, { modules });
}

export async function deleteUser(id: string): Promise<{ id: string }> {
  return http.delete<{ id: string }>(`/users/${id}`);
}

export async function uploadUserPhoto(id: string, file: File): Promise<UserAccount> {
  return uploadFile<UserAccount>(`/users/${id}/photo`, file, "photo");
}

export async function deleteUserPhoto(id: string): Promise<UserAccount> {
  return http.delete<UserAccount>(`/users/${id}/photo`);
}

// Signature électronique gérée PAR UN ADMINISTRATEUR pour le compte
// d'autrui (2026-09) — voir SignatureManager.tsx (mode `userId`) et
// backend/src/users/users.controller.ts. Distinct de
// services/maSignature.service.ts (libre-service, "moi").
export async function uploadUserSignature(id: string, file: File): Promise<UserAccount> {
  return uploadFile<UserAccount>(`/users/${id}/signature`, file, "signature");
}

export async function deleteUserSignature(id: string): Promise<UserAccount> {
  return http.delete<UserAccount>(`/users/${id}/signature`);
}

export async function genererQrSignatureUtilisateur(id: string): Promise<JetonSignatureQr> {
  return http.post<JetonSignatureQr>(`/users/${id}/signature/qr`, {});
}

// Dérivé des comptes réels — plus de liste figée à part (voir demande
// "pas de données codées en dur") : le libellé vient de roles.ts, le
// nombre d'utilisateurs est compté sur les comptes chargés.
export function computeRoleSummaries(users: UserAccount[]): RoleSummary[] {
  return Object.values(roles).map((r) => ({
    id: r.id,
    label: r.label,
    nombreUtilisateurs: users.filter((u) => u.roleId === r.id).length,
  }));
}
