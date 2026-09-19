import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ResiliationsService } from "./resiliations.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateResiliationDto } from "./dto/create-resiliation.dto";

@Controller("resiliations")
@UseGuards(JwtAuthGuard)
export class ResiliationsController {
  constructor(private readonly service: ResiliationsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateResiliationDto) {
    return this.service.create(dto);
  }

  @Patch(":id/valider")
  valider(@Param("id") id: string) {
    return this.service.valider(id);
  }

  @Patch(":id/effective")
  rendreEffective(@Param("id") id: string) {
    return this.service.rendreEffective(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
