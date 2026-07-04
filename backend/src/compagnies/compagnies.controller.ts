import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CompagniesService } from "./compagnies.service";
import { CreateCompagnieDto } from "./dto/create-compagnie.dto";
import { UpdateCompagnieDto } from "./dto/update-compagnie.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("compagnies")
@UseGuards(JwtAuthGuard)
export class CompagniesController {
  constructor(private readonly compagniesService: CompagniesService) {}

  @Get()
  findAll() {
    return this.compagniesService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.compagniesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCompagnieDto) {
    return this.compagniesService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCompagnieDto) {
    return this.compagniesService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.compagniesService.remove(id);
  }
}
