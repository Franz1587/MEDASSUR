import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ComptabiliteService } from "./comptabilite.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateJournalEntryDto } from "./dto/create-journal-entry.dto";

@Controller("comptabilite/journal")
@UseGuards(JwtAuthGuard)
export class ComptabiliteController {
  constructor(private readonly service: ComptabiliteService) {}

  @Get()
  findJournal() {
    return this.service.findJournal();
  }

  @Post()
  create(@Body() dto: CreateJournalEntryDto) {
    return this.service.create(dto);
  }
}
