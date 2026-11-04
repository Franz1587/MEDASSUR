import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Request } from "express";
import { CommunicationsService } from "./communications.service";
import { BrouillonCommunicationDto, EnvoyerCommunicationDto, MajCommunicationDto, SignatureDto } from "./dto/envoyer-communication.dto";
import { RetourCommunicationDto } from "./dto/retour-communication.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

type Req2 = Request & { user: { userId: string } };
const UPLOAD = FilesInterceptor("fichiers", 20, { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

@Controller("communications")
@UseGuards(JwtAuthGuard)
export class CommunicationsController {
  constructor(private readonly service: CommunicationsService) {}

  @Get("config")
  config() { return this.service.config(); }

  @Get("compteurs")
  compteurs() { return this.service.compteurs(); }

  @Get("signature")
  signature(@Req() req: Req2) { return this.service.signature(req.user.userId); }

  @Put("signature")
  enregistrerSignature(@Body() dto: SignatureDto, @Req() req: Req2) { return this.service.enregistrerSignature(req.user.userId, dto); }

  @Get()
  findAll(
    @Query("canal") canal?: string, @Query("destinataireType") destinataireType?: string, @Query("declencheur") declencheur?: string,
    @Query("dossier") dossier?: string, @Query("q") q?: string,
  ) {
    return this.service.findAll({ canal, destinataireType, declencheur, dossier, q });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseInterceptors(UPLOAD)
  envoyer(@Body() dto: EnvoyerCommunicationDto, @Req() req: Req2, @UploadedFiles() fichiers?: Express.Multer.File[]) {
    return this.service.envoyer(dto, req.user.userId, fichiers);
  }

  @Post("brouillons")
  @UseInterceptors(UPLOAD)
  creerBrouillon(@Body() dto: BrouillonCommunicationDto, @Req() req: Req2, @UploadedFiles() fichiers?: Express.Multer.File[]) {
    return this.service.enregistrerBrouillon(dto, req.user.userId, fichiers);
  }

  @Patch("brouillons/:id")
  @UseInterceptors(UPLOAD)
  majBrouillon(@Param("id") id: string, @Body() dto: BrouillonCommunicationDto, @Req() req: Req2, @UploadedFiles() fichiers?: Express.Multer.File[]) {
    return this.service.enregistrerBrouillon(dto, req.user.userId, fichiers, id);
  }

  @Patch(":id/retour")
  enregistrerRetour(@Param("id") id: string, @Body() dto: RetourCommunicationDto) {
    return this.service.enregistrerRetour(id, dto.retour);
  }

  @Patch(":id")
  maj(@Param("id") id: string, @Body() dto: MajCommunicationDto) {
    return this.service.maj(id, dto);
  }

  @Delete(":id")
  supprimer(@Param("id") id: string) {
    return this.service.supprimerDefinitivement(id);
  }
}
