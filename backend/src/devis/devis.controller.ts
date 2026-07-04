import { Controller, Get, UseGuards } from "@nestjs/common";
import { DevisService } from "./devis.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("devis")
@UseGuards(JwtAuthGuard)
export class DevisController {
  constructor(private readonly service: DevisService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
