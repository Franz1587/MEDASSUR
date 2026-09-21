import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Request } from "express";
import { SanteService } from "./sante.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateAssureDto } from "./dto/create-assure.dto";
import { UpdateAssureDto } from "./dto/update-assure.dto";
import { SuspendreAssureDto } from "./dto/suspendre-assure.dto";
import { RetirerAssureDto } from "./dto/retirer-assure.dto";
import { BasculerAssureDto } from "./dto/basculer-assure.dto";
import { CreatePriseEnChargeDto } from "./dto/create-prise-en-charge.dto";
import { UpdatePriseEnChargeDto } from "./dto/update-prise-en-charge.dto";
import { ImportPopulationDto } from "./dto/import-population.dto";

@Controller("sante")
@UseGuards(JwtAuthGuard)
export class SanteController {
  constructor(private readonly service: SanteService) {}

  @Get("assures")
  findAssures(
    @Query("contratId") contratId?: string, @Query("nom") nom?: string, @Query("matricule") matricule?: string,
    @Query("typeAssure") typeAssure?: string, @Query("statut") statut?: string, @Query("sexe") sexe?: string,
  ) {
    return this.service.findAssures({ contratId, nom, matricule, typeAssure, statut, sexe });
  }

  @Post("assures")
  createAssure(@Body() dto: CreateAssureDto) {
    return this.service.createAssure(dto);
  }

  @Post("assures/import")
  importPopulation(@Body() dto: ImportPopulationDto) {
    return this.service.importPopulation(dto);
  }

  // File d'attente des personnes en attente de transfert (2026-09) — voir
  // SanteService.importPopulation.
  @Get("personnes-en-attente-transfert")
  listerPersonnesEnAttenteTransfert() {
    return this.service.listerPersonnesEnAttenteTransfert();
  }

  @Get("personnes-en-attente-transfert/compter")
  compterPersonnesEnAttenteTransfert() {
    return this.service.compterPersonnesEnAttenteTransfert();
  }

  @Delete("personnes-en-attente-transfert/:id")
  ignorerPersonneEnAttenteTransfert(@Param("id") id: string) {
    return this.service.ignorerPersonneEnAttenteTransfert(id);
  }

  // Analyse a posteriori des écarts de taux (2026-09) — voir
  // SanteService.analyserEcartsTauxContrat. `contratId` optionnel (body),
  // absent = tous les contrats.
  @Post("analyser-ecarts-taux")
  analyserEcartsTauxContrat(@Body("contratId") contratId?: string) {
    return this.service.analyserEcartsTauxContrat(contratId);
  }

  @Patch("assures/:id")
  updateAssure(@Param("id") id: string, @Body() dto: UpdateAssureDto) {
    return this.service.updateAssure(id, dto);
  }

  @Post("assures/:id/photo")
  @UseInterceptors(FileInterceptor("photo", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadPhoto(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadPhoto(id, file);
  }

  @Delete("assures/:id/photo")
  deletePhoto(@Param("id") id: string) {
    return this.service.deletePhoto(id);
  }

  @Patch("assures/:id/carte")
  toggleCarte(@Param("id") id: string) {
    return this.service.toggleCarte(id);
  }

  @Patch("assures/:id/suspendre")
  suspendreAssure(@Param("id") id: string, @Body() dto: SuspendreAssureDto) {
    return this.service.suspendreAssure(id, dto.suspendre);
  }

  @Post("assures/:id/retrait")
  retirerDuContrat(@Param("id") id: string, @Body() dto: RetirerAssureDto) {
    return this.service.retirerDuContrat(id, dto.dateEffet, dto.motif);
  }

  @Post("assures/:id/bascule")
  basculerAssureVersContrat(@Param("id") id: string, @Body() dto: BasculerAssureDto) {
    return this.service.basculerAssureVersContrat(id, dto.contratDestinationId, dto.avecFamille, dto.dateEffet);
  }

  @Get("assures/:id/mouvements")
  mouvementsDe(@Param("id") id: string) {
    return this.service.mouvementsDe(id);
  }

  @Delete("assures/:id")
  removeAssure(@Param("id") id: string) {
    return this.service.removeAssure(id);
  }

  @Get("prises-en-charge")
  findPrisesEnCharge(
    @Query("assureIds") assureIds?: string, @Query("contratId") contratId?: string, @Query("gestionnaireId") gestionnaireId?: string,
  ) {
    return this.service.findPrisesEnCharge(assureIds ? assureIds.split(",").filter(Boolean) : undefined, contratId, gestionnaireId);
  }

  @Post("prises-en-charge")
  createPriseEnCharge(@Body() dto: CreatePriseEnChargeDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.createPriseEnCharge(dto, req.user.userId);
  }

  @Patch("prises-en-charge/:id")
  updatePriseEnCharge(@Param("id") id: string, @Body() dto: UpdatePriseEnChargeDto) {
    return this.service.updatePriseEnCharge(id, dto);
  }
}
