import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { ROLES_DIRECTION } from "../auth/access-roles";
import { TenantContext } from "../tenant/tenant-context";
import { RelancesService } from "./relances.service";
import { UpsertNiveauRelanceDto } from "./dto/upsert-niveau-relance.dto";

function sid() {
  const id = TenantContext.getSocieteId();
  if (!id) throw new BadRequestException("Société non déterminée");
  return id;
}

@UseGuards(JwtAuthGuard)
@Roles(...ROLES_DIRECTION)
@Controller("relances")
export class RelancesController {
  constructor(private service: RelancesService) {}

  @Get("niveaux")
  findNiveaux() { return this.service.findNiveaux(sid()); }

  @Post("niveaux")
  upsert(@Body() dto: UpsertNiveauRelanceDto) { return this.service.upsert(sid(), dto); }

  @Delete("niveaux/:id")
  deleteNiveau(@Param("id") id: string) { return this.service.deleteNiveau(id); }

  @Get("historique")
  findHistorique() { return this.service.findHistorique(sid()); }

  @Post("declencher")
  declencher() { return this.service.envoyerRelancesDues(sid()); }
}
