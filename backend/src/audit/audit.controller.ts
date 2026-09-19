import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuditLogService } from "./audit-log.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("audit")
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  findAll(
    @Query("entite") entite?: string,
    @Query("entiteId") entiteId?: string,
    @Query("utilisateur") utilisateur?: string,
    @Query("action") action?: string,
    @Query("du") du?: string,
    @Query("au") au?: string,
  ) {
    return this.service.findAll({ entite, entiteId, utilisateur, action, du, au });
  }

  // Widget "dernière modification" sur une fiche (contrat/facture/prise en
  // charge) — voir demande utilisateur.
  @Get("derniere-modification")
  derniereModification(@Query("entite") entite: string, @Query("entiteId") entiteId: string) {
    return this.service.derniereModification(entite, entiteId);
  }

  // Capacité de traitement par agent — voir demande utilisateur.
  @Get("stats-agents")
  statsParAgent(@Query("du") du?: string, @Query("au") au?: string) {
    return this.service.statsParAgent({ du, au });
  }

  // État global — édition/téléchargement/impression (2026-08) — voir
  // demande utilisateur : "on doit pouvoir en éditer, télécharger et
  // imprimer un état global, par type d'action, par date, mais aussi par
  // agents." Mêmes filtres que la recherche à l'écran (voir findAll).
  @Get("export")
  export(
    @Query("format") format: "pdf" | "xlsx" = "pdf",
    @Res() res: Response,
    @Query("entite") entite?: string,
    @Query("entiteId") entiteId?: string,
    @Query("utilisateur") utilisateur?: string,
    @Query("action") action?: string,
    @Query("du") du?: string,
    @Query("au") au?: string,
  ) {
    return this.service.genererEtatGlobal({ entite, entiteId, utilisateur, action, du, au }, format, res);
  }
}
