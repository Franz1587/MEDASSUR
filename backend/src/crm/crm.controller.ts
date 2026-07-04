import { Controller, Get, UseGuards } from "@nestjs/common";
import { CrmService } from "./crm.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("crm/prospects")
@UseGuards(JwtAuthGuard)
export class CrmController {
  constructor(private readonly service: CrmService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
