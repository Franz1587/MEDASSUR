import { Controller, Get, UseGuards } from "@nestjs/common";
import { CommissionsService } from "./commissions.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("commissions")
@UseGuards(JwtAuthGuard)
export class CommissionsController {
  constructor(private readonly service: CommissionsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
