import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { RubriqueFacturationService } from "./rubrique-facturation.service";
import { CreateRubriqueFacturationDto, UpdateRubriqueFacturationDto } from "./dto/rubrique-facturation.dto";

// Catalogue des rubriques de facturation — réservé au Super Admin (voir
// RubriqueFacturationService).
@Controller("rubriques-facturation")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class RubriqueFacturationController {
  constructor(private readonly service: RubriqueFacturationService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateRubriqueFacturationDto) {
    return this.service.create(dto);
  }

  @Patch(":code")
  update(@Param("code") code: string, @Body() dto: UpdateRubriqueFacturationDto) {
    return this.service.update(code, dto);
  }

  @Delete(":code")
  remove(@Param("code") code: string) {
    return this.service.remove(code);
  }
}
