import { Controller, Get, UseGuards } from "@nestjs/common";
import { HonorairesService } from "./honoraires.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("honoraires")
@UseGuards(JwtAuthGuard)
export class HonorairesController {
  constructor(private readonly service: HonorairesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
