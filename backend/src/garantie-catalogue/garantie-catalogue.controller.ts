import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { GarantieCatalogueService } from "./garantie-catalogue.service";
import { CreateGarantieCatalogueDto } from "./dto/create-garantie-catalogue.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequireModule } from "../auth/access.decorators";
import { Roles } from "../auth/roles.decorator";
import { ROLES_PRODUCTION } from "../auth/access-roles";

// Lecture aussi utilisée par le formulaire de contrat (garanties proposées).
@Controller("garantie-catalogue")
@UseGuards(JwtAuthGuard)
@RequireModule("garantiesCatalogue", "contrats")
export class GarantieCatalogueController {
  constructor(private readonly garantieCatalogueService: GarantieCatalogueService) {}

  @Get()
  findAll() {
    return this.garantieCatalogueService.findAll();
  }

  @Roles(...ROLES_PRODUCTION)
  @Post()
  create(@Body() dto: CreateGarantieCatalogueDto) {
    return this.garantieCatalogueService.create(dto);
  }

  @Roles(...ROLES_PRODUCTION)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.garantieCatalogueService.remove(id);
  }
}
