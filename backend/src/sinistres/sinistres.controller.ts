import { Controller, Get, UseGuards } from "@nestjs/common";
import { SinistresService } from "./sinistres.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("sinistres")
@UseGuards(JwtAuthGuard)
export class SinistresController {
  constructor(private readonly service: SinistresService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
