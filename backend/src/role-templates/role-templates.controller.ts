import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { RoleTemplatesService } from "./role-templates.service";
import { UpdateRoleTemplateDto } from "./dto/update-role-template.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

// Écran Administration → "Rôles" : modèle de droits par défaut PAR TYPE
// D'UTILISATEUR (voir demande utilisateur, section "Rôles (modèle par
// défaut)"). Distinct de /users/:id/modules (droits par utilisateur précis).
@Controller("role-templates")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("administrateur", "direction_generale")
export class RoleTemplatesController {
  constructor(private readonly service: RoleTemplatesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Patch(":roleId")
  update(@Param("roleId") roleId: string, @Body() dto: UpdateRoleTemplateDto) {
    return this.service.update(roleId, dto.modules);
  }
}
