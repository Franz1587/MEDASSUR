import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AppelOffresService } from "./appel-offres.service";
import { CreateAppelOffresDto } from "./dto/create-appel-offres.dto";
import { CreatePropositionDto } from "./dto/create-proposition.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("appel-offres")
@UseGuards(JwtAuthGuard)
export class AppelOffresController {
  constructor(private readonly service: AppelOffresService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAppelOffresDto) {
    return this.service.create(dto);
  }

  @Post(":id/propositions")
  ajouterProposition(@Param("id") id: string, @Body() dto: CreatePropositionDto) {
    return this.service.ajouterProposition(id, dto);
  }
}
