import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { GedService } from "./ged.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateGedDocumentDto } from "./dto/create-ged-document.dto";

@Controller("ged/documents")
@UseGuards(JwtAuthGuard)
export class GedController {
  constructor(private readonly service: GedService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateGedDocumentDto) {
    return this.service.create(dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
