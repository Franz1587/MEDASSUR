import { Body, Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { DocumentsService } from "./documents.service";
import { GenererCartesDto } from "./dto/generer-cartes.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { RubriqueId } from "../statistiques/statistiques.types";
import type { AnalyseNarrative } from "../statistiques/statistiques.types";

@Controller("documents")
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get("quittance/:contratId")
  quittance(@Param("contratId") contratId: string, @Res() res: Response) {
    return this.documentsService.renderQuittance(contratId, res);
  }

  @Get("quittance-avenant/:avenantId")
  quittanceAvenant(@Param("avenantId") avenantId: string, @Res() res: Response) {
    return this.documentsService.renderQuittanceAvenant(avenantId, res);
  }

  @Get("tableau-garanties/:contratId")
  tableauGaranties(@Param("contratId") contratId: string, @Res() res: Response) {
    return this.documentsService.renderTableauGaranties(contratId, res);
  }

  @Get("avenant/:avenantId")
  avenant(@Param("avenantId") avenantId: string, @Res() res: Response) {
    return this.documentsService.renderAvenant(avenantId, res);
  }

  @Get("carte/:assureId")
  carteUnique(@Param("assureId") assureId: string, @Res() res: Response) {
    return this.documentsService.renderCarteUnique(assureId, res);
  }

  @Post("cartes")
  cartesEnMasse(@Body() dto: GenererCartesDto, @Res() res: Response) {
    return this.documentsService.renderCartesEnMasse(dto, res);
  }

  @Post("statistiques/:contratId")
  statistiques(
    @Param("contratId") contratId: string,
    @Body() body: { format?: "pdf" | "docx"; du?: string; au?: string; primeForcee?: number; analyse?: AnalyseNarrative; rubriques?: RubriqueId[] },
    @Res() res: Response,
  ) {
    return this.documentsService.renderStatistiques(
      contratId, body.du, body.au, body.format ?? "pdf", res, body.analyse, body.rubriques, body.primeForcee,
    );
  }
}
