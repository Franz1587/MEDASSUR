import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
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
