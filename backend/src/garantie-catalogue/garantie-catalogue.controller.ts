import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { GarantieCatalogueService } from "./garantie-catalogue.service";
import { CreateGarantieCatalogueDto } from "./dto/create-garantie-catalogue.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("garantie-catalogue")
@UseGuards(JwtAuthGuard)
export class GarantieCatalogueController {
  constructor(private readonly garantieCatalogueService: GarantieCatalogueService) {}

  @Get()
  findAll() {
    return this.garantieCatalogueService.findAll();
  }

  @Post()
  create(@Body() dto: CreateGarantieCatalogueDto) {
    return this.garantieCatalogueService.create(dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.garantieCatalogueService.remove(id);
  }
}
