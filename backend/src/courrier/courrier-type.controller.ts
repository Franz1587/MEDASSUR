import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CourrierTypeService } from "./courrier-type.service";
import { CreateCourrierTypeDto } from "./dto/create-courrier-type.dto";
import { UpdateCourrierTypeDto } from "./dto/update-courrier-type.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("modeles-courrier")
@UseGuards(JwtAuthGuard)
export class CourrierTypeController {
  constructor(private readonly service: CourrierTypeService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCourrierTypeDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCourrierTypeDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
