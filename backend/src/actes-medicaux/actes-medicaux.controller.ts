import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ActesMedicauxService } from "./actes-medicaux.service";
import { CreateActeMedicalDto } from "./dto/create-acte-medical.dto";
import { UpdateActeMedicalDto } from "./dto/update-acte-medical.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("actes-medicaux")
@UseGuards(JwtAuthGuard)
export class ActesMedicauxController {
  constructor(private readonly actesMedicauxService: ActesMedicauxService) {}

  @Get()
  findAll(@Query("famille") famille?: string) {
    return this.actesMedicauxService.findAll(famille);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.actesMedicauxService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateActeMedicalDto) {
    return this.actesMedicauxService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateActeMedicalDto) {
    return this.actesMedicauxService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.actesMedicauxService.remove(id);
  }
}
