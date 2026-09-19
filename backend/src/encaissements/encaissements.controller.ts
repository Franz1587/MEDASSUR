import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EncaissementsService } from "./encaissements.service";
import { CreateEncaissementDto } from "./dto/create-encaissement.dto";

@Controller("encaissements")
@UseGuards(JwtAuthGuard)
export class EncaissementsController {
  constructor(private readonly service: EncaissementsService) {}

  @Get()
  findAll(@Query("contratId") contratId?: string) {
    return this.service.findAll(contratId);
  }

  @Post()
  create(@Body() dto: CreateEncaissementDto) {
    return this.service.create(dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
