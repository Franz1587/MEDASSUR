import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PerformanceService } from "./performance.service";

// Performance / usage de la plateforme (2026-09) — voir demande
// utilisateur : "un écran lui permettant de voir les performances
// d'utilisation de l'application." Réservé au Super Admin.
@Controller("performance")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  @Get("societes")
  parSociete() {
    return this.service.parSociete();
  }

  @Get("global")
  global() {
    return this.service.global();
  }
}
