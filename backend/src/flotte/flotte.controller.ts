import { Controller, Get, UseGuards } from "@nestjs/common";
import { FlotteService } from "./flotte.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("flotte")
@UseGuards(JwtAuthGuard)
export class FlotteController {
  constructor(private readonly service: FlotteService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
