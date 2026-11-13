import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { FondsDeRoulementService } from "./fonds-de-roulement.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { ROLES_FINANCE } from "../auth/access-roles";
import { CreateFondsDeRoulementDto } from "./dto/create-fonds-de-roulement.dto";
import { ConsommerDto } from "./dto/consommer.dto";

@Controller("fonds-de-roulement")
@UseGuards(JwtAuthGuard)
@Roles(...ROLES_FINANCE)
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
