import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ROLE_IDS } from "../auth/role.enum";
import { ROLE_MODULES } from "../auth/role-modules";

// Modèle de droits GÉNÉRIQUE par type d'utilisateur (rôle) — voir demande
// utilisateur : "on peut créer des champs génériques à attribuer aux types
// d'utilisateur, mais on peut aussi de façon spécifique donner des droits
// supplémentaires à un utilisateur bien spécifique". Ce service gère le
// niveau GÉNÉRIQUE (RoleModuleTemplate, éditable depuis Administration →
// "Rôles") ; le niveau SPÉCIFIQUE reste UsersService.updateModules
// (User.modules, par utilisateur).
@Injectable()
export class RoleTemplatesService {
  constructor(private prisma: PrismaService) {}

  // Toujours les ROLE_IDS complets, même si une ligne manque en base (ex.
  // rôle ajouté au code après le seed initial) — repli sur ROLE_MODULES
  // codé en dur dans ce cas, jamais une liste vide qui masquerait le rôle.
  async findAll() {
    const lignes = await this.prisma.roleModuleTemplate.findMany();
    const parRole = new Map(lignes.map((l) => [l.roleId, l.modules]));
    return ROLE_IDS.map((roleId) => ({ roleId, modules: parRole.get(roleId) ?? ROLE_MODULES[roleId] ?? [] }));
  }

  async update(roleId: string, modules: string[]) {
    return this.prisma.roleModuleTemplate.upsert({
      where: { roleId },
      update: { modules },
      create: { roleId, modules },
    });
  }
}
