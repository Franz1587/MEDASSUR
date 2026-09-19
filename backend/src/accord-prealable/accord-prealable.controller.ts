import { Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Request } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { AccordPrealableService } from "./accord-prealable.service";
import { CreateAccordPrealableDto } from "./dto/create-accord-prealable.dto";
import { DecisionAccordPrealableDto } from "./dto/decision-accord-prealable.dto";
import { UpdateAccordPrealableDto } from "./dto/update-accord-prealable.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("accord-prealable")
@UseGuards(JwtAuthGuard)
export class AccordPrealableController {
  constructor(private readonly service: AccordPrealableService) {}

  @Get()
  findAll(
    @Query("contratId") contratId?: string,
    @Query("prestataireId") prestataireId?: string,
    @Query("type") type?: string,
    @Query("decision") decision?: string,
    @Query("origine") origine?: string,
    @Query("du") du?: string,
    @Query("au") au?: string,
    @Query("reference") reference?: string,
  ) {
    return this.service.findAll({ contratId, prestataireId, type, decision, origine, du, au, reference });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAccordPrealableDto, @Req() req: Request & { user: { userId: string } }) {
    return this.service.create(dto, req.user.userId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAccordPrealableDto) {
    return this.service.update(id, dto);
  }

  // Prise en main d'un dossier (2026-09) — voir demande utilisateur :
  // "étendre le fait de prendre en main un dossier aux agents de saisie,
  // gestionnaire sinistre et gestionnaires production".
  @Patch(":id/prendre")
  prendre(@Param("id") id: string, @Req() req: Request & { user: { userId: string } }) {
    return this.service.prendre(id, req.user.userId);
  }

  @Patch(":id/decision")
  decider(@Param("id") id: string, @Body() dto: DecisionAccordPrealableDto) {
    return this.service.decider(id, dto);
  }

  // Contrôleur de demande/saisie (2026-08) — voir demande utilisateur :
  // annule un dossier "En attente" détecté en doublon, pour laisser la
  // place à une nouvelle saisie.
  @Patch(":id/annuler")
  annuler(@Param("id") id: string, @Body("motif") motif?: string) {
    return this.service.annuler(id, motif);
  }

  @Post(":id/ordonnance")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadOrdonnance(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadDocument(id, "ordonnance", file);
  }

  @Post(":id/devis")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadDevis(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadDocument(id, "devis", file);
  }
}
