import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ContratsService } from "./contrats.service";
import { CreateContratDto } from "./dto/create-contrat.dto";
import { UpdateContratDto } from "./dto/update-contrat.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("contrats")
@UseGuards(JwtAuthGuard)
export class ContratsController {
  constructor(private readonly contratsService: ContratsService) {}

  @Get()
  findAll() {
    return this.contratsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.contratsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateContratDto) {
    return this.contratsService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateContratDto) {
    return this.contratsService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.contratsService.remove(id);
  }
}
