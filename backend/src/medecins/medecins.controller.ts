import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MedecinsService } from "./medecins.service";
import { CreateMedecinDto } from "./dto/create-medecin.dto";
import { UpdateMedecinDto } from "./dto/update-medecin.dto";
import { RequireModule } from "../auth/access.decorators";
import { Roles } from "../auth/roles.decorator";
import { ROLES_SANTE } from "../auth/access-roles";

// Lecture aussi utilisée par la fiche prestataire et le règlement prestataire.
@Controller("medecins")
@UseGuards(JwtAuthGuard)
@RequireModule("professionnelsSante", "prestataires", "reglementPrestataire")
export class MedecinsController {
  constructor(private readonly medecins: MedecinsService) {}

  @Get()
  findAll(@Query("q") q?: string, @Query("prestataireId") prestataireId?: string) {
    return this.medecins.findAll({ q, prestataireId });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.medecins.findOne(id);
  }

  @Roles(...ROLES_SANTE)
  @Post()
  create(@Body() dto: CreateMedecinDto) {
    return this.medecins.create(dto);
  }

  @Roles(...ROLES_SANTE)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateMedecinDto) {
    return this.medecins.update(id, dto);
  }

  @Roles(...ROLES_SANTE)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.medecins.remove(id);
  }

  @Roles(...ROLES_SANTE)
  @Post(":id/structures/:prestataireId")
  lierStructure(@Param("id") id: string, @Param("prestataireId") prestataireId: string) {
    return this.medecins.lierStructure(id, prestataireId);
  }

  @Roles(...ROLES_SANTE)
  @Delete(":id/structures/:prestataireId")
  delierStructure(@Param("id") id: string, @Param("prestataireId") prestataireId: string) {
    return this.medecins.delierStructure(id, prestataireId);
  }
}
