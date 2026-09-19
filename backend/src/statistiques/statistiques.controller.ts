import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { StatistiquesService } from "./statistiques.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

// Rapport Statistiques (2026-08) — voir demande utilisateur : "une version
// en ligne avec les chiffres, les tableaux et les graphiques". Aucune
// persistance : recalculé en direct à chaque appel (voir StatistiquesService).
@Controller("statistiques")
@UseGuards(JwtAuthGuard)
export class StatistiquesController {
  constructor(private readonly service: StatistiquesService) {}

  @Get(":contratId")
  calculer(@Param("contratId") contratId: string, @Query("du") du?: string, @Query("au") au?: string) {
    return this.service.calculer(contratId, du, au);
  }
}
