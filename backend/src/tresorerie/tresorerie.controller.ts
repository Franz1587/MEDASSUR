import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TresorerieService } from "./tresorerie.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { ROLES_FINANCE, ROLES_RECOUVREMENT } from "../auth/access-roles";
import { CreateFluxDto } from "./dto/create-flux.dto";

@Controller("tresorerie")
@UseGuards(JwtAuthGuard)
export class TresorerieController {
  constructor(private readonly service: TresorerieService) {}

  // Lu aussi par le tableau de bord Finance (agent de recouvrement inclus).
  @Roles(...ROLES_RECOUVREMENT)
  @Get("comptes")
  findComptes() {
    return this.service.findComptes();
  }

  @Roles(...ROLES_FINANCE)
  @Get("flux")
  findFlux() {
    return this.service.findFlux();
  }

  @Roles(...ROLES_FINANCE)
  @Post("flux")
  createFlux(@Body() dto: CreateFluxDto) {
    return this.service.createFlux(dto);
  }

  @Roles(...ROLES_FINANCE)
  @Patch("flux/:id/rapprocher")
  rapprocher(@Param("id") id: string) {
    return this.service.rapprocher(id);
  }
}
