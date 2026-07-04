import { Controller, Get, UseGuards } from "@nestjs/common";
import { SanteService } from "./sante.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("sante")
@UseGuards(JwtAuthGuard)
export class SanteController {
  constructor(private readonly service: SanteService) {}

  @Get("assures")
  findAssures() {
    return this.service.findAssures();
  }

  @Get("prises-en-charge")
  findPrisesEnCharge() {
    return this.service.findPrisesEnCharge();
  }
}
