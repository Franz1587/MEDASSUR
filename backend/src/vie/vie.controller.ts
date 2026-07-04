import { Controller, Get, UseGuards } from "@nestjs/common";
import { VieService } from "./vie.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("vie")
@UseGuards(JwtAuthGuard)
export class VieController {
  constructor(private readonly service: VieService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
