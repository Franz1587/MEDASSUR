import { Controller, Get, UseGuards } from "@nestjs/common";
import { FondsDeRoulementService } from "./fonds-de-roulement.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("fonds-de-roulement")
@UseGuards(JwtAuthGuard)
export class FondsDeRoulementController {
  constructor(private readonly service: FondsDeRoulementService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
