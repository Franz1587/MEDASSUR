import { Controller, Get, UseGuards } from "@nestjs/common";
import { RecouvrementService } from "./recouvrement.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("recouvrement")
@UseGuards(JwtAuthGuard)
export class RecouvrementController {
  constructor(private readonly service: RecouvrementService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
