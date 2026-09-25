import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import type { RoleId } from "../auth/role.enum";
import { RapportsIaService } from "./rapports-ia.service";

// Mêmes rôles que la clé de module "rapportsIa" (voir backend/src/auth/
// role-modules.ts) — écran interne de supervision, jamais accessible à un
// portail externe (assuré/prestataire/souscripteur).
export const ROLES_RAPPORTS_IA: RoleId[] = [
  "administrateur", "direction_generale", "directeur_technique",
  "gestionnaire_production", "gestionnaire_sinistres", "gestionnaire_sante", "gestionnaire_entreprises",
];

@Controller("rapports-ia")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_RAPPORTS_IA)
export class RapportsIaController {
  constructor(private readonly service: RapportsIaService) {}

  @Get()
  findAll(@Query("lu") lu?: string) {
    return this.service.findAll(lu);
  }

  @Patch(":id/lu")
  marquerLu(@Param("id") id: string, @Body("lu") lu: boolean) {
    return this.service.marquerLu(id, lu !== false);
  }
}
