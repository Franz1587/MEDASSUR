import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Request } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { DemandesClientService, ROLES_GESTION_DEMANDES_CLIENT } from "./demandes-client.service";
import { CreateDemandeClientDto } from "./dto/create-demande-client.dto";
import { DecisionDemandeClientDto } from "./dto/decision-demande-client.dto";

type PortailRequest = Request & { user: { userId: string; roleId: string; clientId: string | null } };

@Controller("demandes-client")
@UseGuards(JwtAuthGuard)
export class DemandesClientController {
  constructor(private readonly service: DemandesClientService) {}

  // Côté portail client — création + historique du client connecté.
  @Post()
  @UseGuards(RolesGuard)
  @Roles("client_entreprise", "client_particulier")
  create(@Body() dto: CreateDemandeClientDto, @Req() req: PortailRequest) {
    if (!req.user.clientId) throw new ForbiddenException("Ce compte n'est rattaché à aucun souscripteur.");
    return this.service.create(dto, req.user.userId, req.user.clientId);
  }

  @Get("mine")
  @UseGuards(RolesGuard)
  @Roles("client_entreprise", "client_particulier")
  mine(@Req() req: PortailRequest) {
    if (!req.user.clientId) throw new ForbiddenException("Ce compte n'est rattaché à aucun souscripteur.");
    return this.service.findMine(req.user.clientId);
  }

  // Photo d'un bénéficiaire — voir demande utilisateur : "rendre possible
  // l'ajout des photos pour rendre possible l'édition des cartes côté
  // assurance". Chargée après création du bénéficiaire (même principe que
  // AccordPrealableController ordonnance/devis).
  @Post("beneficiaires/:beneficiaireId/photo")
  @UseGuards(RolesGuard)
  @Roles("client_entreprise", "client_particulier")
  @UseInterceptors(FileInterceptor("photo", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadPhotoBeneficiaire(@Param("beneficiaireId") beneficiaireId: string, @UploadedFile() file: Express.Multer.File, @Req() req: PortailRequest) {
    if (!req.user.clientId) throw new ForbiddenException("Ce compte n'est rattaché à aucun souscripteur.");
    return this.service.uploadPhotoBeneficiaire(beneficiaireId, req.user.clientId, file);
  }

  // Côté interne — gestionnaires uniquement.
  @Get()
  @UseGuards(RolesGuard)
  @Roles(...ROLES_GESTION_DEMANDES_CLIENT)
  findAll(@Query("statut") statut?: string) {
    return this.service.findAll(statut);
  }

  // Prise en main d'un dossier (2026-09) — voir demande utilisateur :
  // "étendre le fait de prendre en main un dossier aux agents de saisie,
  // gestionnaire sinistre et gestionnaires production".
  @Patch(":id/prendre")
  @UseGuards(RolesGuard)
  @Roles(...ROLES_GESTION_DEMANDES_CLIENT)
  prendre(@Param("id") id: string, @Req() req: PortailRequest) {
    return this.service.prendre(id, req.user.userId);
  }

  @Patch(":id/decision")
  @UseGuards(RolesGuard)
  @Roles(...ROLES_GESTION_DEMANDES_CLIENT)
  decider(@Param("id") id: string, @Body() dto: DecisionDemandeClientDto, @Req() req: PortailRequest) {
    return this.service.decider(id, dto, req.user.userId);
  }
}
