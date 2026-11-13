import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AgencesService } from "./agences.service";
import { CreateAgenceDto } from "./dto/create-agence.dto";
import { UpdateAgenceDto } from "./dto/update-agence.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { ROLES_BANQUES } from "../auth/access-roles";

@Controller("agences")
@UseGuards(JwtAuthGuard)
export class AgencesController {
  constructor(private readonly service: AgencesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(...ROLES_BANQUES)
  @Post()
  create(@Body() dto: CreateAgenceDto) {
    return this.service.create(dto);
  }

  @Roles(...ROLES_BANQUES)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAgenceDto) {
    return this.service.update(id, dto);
  }

  @Roles(...ROLES_BANQUES)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
