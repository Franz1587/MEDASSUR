import { Controller, Get, UseGuards } from "@nestjs/common";
import { GedService } from "./ged.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("ged/documents")
@UseGuards(JwtAuthGuard)
export class GedController {
  constructor(private readonly service: GedService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
