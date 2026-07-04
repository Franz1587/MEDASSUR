import { Controller, Get, UseGuards } from "@nestjs/common";
import { AvenantsService } from "./avenants.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("avenants")
@UseGuards(JwtAuthGuard)
export class AvenantsController {
  constructor(private readonly service: AvenantsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
