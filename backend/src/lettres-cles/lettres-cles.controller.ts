import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { LettresClesService } from "./lettres-cles.service";
import { CreateLettreCleDto } from "./dto/create-lettre-cle.dto";
import { UpdateLettreCleDto } from "./dto/update-lettre-cle.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequireModule } from "../auth/access.decorators";
import { Roles } from "../auth/roles.decorator";
import { ROLES_SANTE } from "../auth/access-roles";

// Lecture aussi utilisée par les écrans de saisie (accords préalables, actes, prises en charge).
@Controller("lettres-cles")
@UseGuards(JwtAuthGuard)
@RequireModule("lettresCles", "accordPrealable", "prisesEnCharge", "actesMedicaux")
export class LettresClesController {
  constructor(private readonly service: LettresClesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":code")
  findOne(@Param("code") code: string) {
    return this.service.findOne(code);
  }

  @Roles(...ROLES_SANTE)
  @Post()
  create(@Body() dto: CreateLettreCleDto) {
    return this.service.create(dto);
  }

  @Roles(...ROLES_SANTE)
  @Patch(":code")
  update(@Param("code") code: string, @Body() dto: UpdateLettreCleDto) {
    return this.service.update(code, dto);
  }

  @Roles(...ROLES_SANTE)
  @Delete(":code")
  remove(@Param("code") code: string) {
    return this.service.remove(code);
  }
}
