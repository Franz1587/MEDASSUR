import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AgencesService } from "./agences.service";
import { CreateAgenceDto } from "./dto/create-agence.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("agences")
@UseGuards(JwtAuthGuard)
export class AgencesController {
  constructor(private readonly service: AgencesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateAgenceDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: Partial<CreateAgenceDto>) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
