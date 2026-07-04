import { Controller, Get, UseGuards } from "@nestjs/common";
import { TresorerieService } from "./tresorerie.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

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
}
