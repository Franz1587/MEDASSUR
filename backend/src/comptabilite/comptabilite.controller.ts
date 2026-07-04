import { Controller, Get, UseGuards } from "@nestjs/common";
import { ComptabiliteService } from "./comptabilite.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("comptabilite/journal")
@UseGuards(JwtAuthGuard)
export class ComptabiliteController {
  constructor(private readonly service: ComptabiliteService) {}

  @Get()
  findJournal() {
    return this.service.findJournal();
  }
}
