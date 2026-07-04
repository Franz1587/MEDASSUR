import { Controller, Get, UseGuards } from "@nestjs/common";
import { RenouvellementsService } from "./renouvellements.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("renouvellements")
@UseGuards(JwtAuthGuard)
export class RenouvellementsController {
  constructor(private readonly service: RenouvellementsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
