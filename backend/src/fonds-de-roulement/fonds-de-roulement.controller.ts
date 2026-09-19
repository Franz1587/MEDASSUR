import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { FondsDeRoulementService } from "./fonds-de-roulement.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateFondsDeRoulementDto } from "./dto/create-fonds-de-roulement.dto";
import { ConsommerDto } from "./dto/consommer.dto";

@Controller("fonds-de-roulement")
@UseGuards(JwtAuthGuard)
export class FondsDeRoulementController {
  constructor(private readonly service: FondsDeRoulementService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateFondsDeRoulementDto) {
    return this.service.create(dto);
  }

  @Patch(":id/consommer")
  consommer(@Param("id") id: string, @Body() dto: ConsommerDto) {
    return this.service.consommer(id, dto);
  }
}
