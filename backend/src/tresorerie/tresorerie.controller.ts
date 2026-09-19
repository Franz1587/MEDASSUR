import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TresorerieService } from "./tresorerie.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateFluxDto } from "./dto/create-flux.dto";

@Controller("tresorerie")
@UseGuards(JwtAuthGuard)
export class TresorerieController {
  constructor(private readonly service: TresorerieService) {}

  @Get("comptes")
  findComptes() {
    return this.service.findComptes();
  }

  @Get("flux")
  findFlux() {
    return this.service.findFlux();
  }

  @Post("flux")
  createFlux(@Body() dto: CreateFluxDto) {
    return this.service.createFlux(dto);
  }

  @Patch("flux/:id/rapprocher")
  rapprocher(@Param("id") id: string) {
    return this.service.rapprocher(id);
  }
}
