import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RenouvellementsService } from "./renouvellements.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { ROLES_PRODUCTION } from "../auth/access-roles";
import { MarquerPerduDto } from "./dto/marquer-perdu.dto";

@Controller("renouvellements")
@UseGuards(JwtAuthGuard)
export class RenouvellementsController {
  constructor(private readonly service: RenouvellementsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(...ROLES_PRODUCTION)
  @Post("relancer-tout")
  relancerToutes() {
    return this.service.relancerToutes();
  }

  @Roles(...ROLES_PRODUCTION)
  @Patch(":id/relancer")
  relancer(@Param("id") id: string) {
    return this.service.relancer(id);
  }

  @Roles(...ROLES_PRODUCTION)
  @Patch(":id/renouveler")
  renouveler(@Param("id") id: string) {
    return this.service.renouveler(id);
  }

  @Roles(...ROLES_PRODUCTION)
  @Patch(":id/perdu")
  marquerPerdu(@Param("id") id: string, @Body() dto: MarquerPerduDto) {
    return this.service.marquerPerdu(id, dto.initiateur ?? "Système");
  }
}
