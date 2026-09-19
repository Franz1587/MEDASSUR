import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PlansAbonnementService } from "./plans-abonnement.service";
import { CreatePlanAbonnementDto } from "./dto/create-plan-abonnement.dto";
import { UpdatePlanAbonnementDto } from "./dto/update-plan-abonnement.dto";

// Catalogue des plans d'abonnement — réservé au Super Admin (voir
// PlansAbonnementService), au même titre que la gestion des sociétés
// elles-mêmes (voir SocietesController).
@Controller("plans-abonnement")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class PlansAbonnementController {
  constructor(private readonly service: PlansAbonnementService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePlanAbonnementDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePlanAbonnementDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
