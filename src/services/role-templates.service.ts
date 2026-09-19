import { http } from "@/lib/http";
import type { RoleId } from "@/auth/roles";

// Modèle de droits GÉNÉRIQUE par type d'utilisateur (rôle) — voir demande
// utilisateur : "on peut créer des champs génériques à attribuer aux types
// d'utilisateur, mais on peut aussi de façon spécifique donner des droits
// supplémentaires à un utilisateur bien spécifique". Distinct de
// admin.service.ts updateUserModules (droits par utilisateur précis).
export interface RoleTemplate {
  roleId: RoleId;
  modules: string[];
}

export async function getRoleTemplates(): Promise<RoleTemplate[]> {
  return http.get<RoleTemplate[]>("/role-templates");
}

export async function updateRoleTemplate(roleId: RoleId, modules: string[]): Promise<RoleTemplate> {
  return http.patch<RoleTemplate>(`/role-templates/${roleId}`, { modules });
}
