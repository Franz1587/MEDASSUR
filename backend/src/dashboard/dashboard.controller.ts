import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";
import { RequireModule } from "../auth/access.decorators";

// Pilotage global (direction), Comptabilité et Rapports : les autres tableaux de bord n'appellent pas ces routes.
@Controller("dashboard")
@UseGuards(JwtAuthGuard)
@RequireModule("comptabilite", "rapports")
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get("pilotage")
  pilotage(@Query("annee") annee?: string) {
    return this.service.pilotage(annee);
  }

  @Get("pilotage/rapport")
  rapport(@Res() res: Response, @Query("annee") annee?: string) {
    return this.service.genererRapportPdf(annee, res);
  }
}
