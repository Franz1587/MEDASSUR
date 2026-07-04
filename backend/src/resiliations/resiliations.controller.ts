import { Controller, Get, UseGuards } from "@nestjs/common";
import { ResiliationsService } from "./resiliations.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("resiliations")
@UseGuards(JwtAuthGuard)
export class ResiliationsController {
  constructor(private readonly service: ResiliationsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
