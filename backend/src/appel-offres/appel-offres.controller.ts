import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { AppelOffresService } from "./appel-offres.service";
import { CreateAppelOffresDto } from "./dto/create-appel-offres.dto";
import { UpdateAppelOffresDto } from "./dto/update-appel-offres.dto";
import { CreatePropositionDto } from "./dto/create-proposition.dto";
import { UpdatePropositionDto } from "./dto/update-proposition.dto";
import { UploadAppelOffresDocumentDto } from "./dto/upload-document.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AnalysePropositionService } from "./analyse-proposition.service";
import { AnalyserDocumentDto, ParametresOffreDto } from "./dto/offre-sante.dto";
import { ChatArianaDto } from "./dto/chat-ariana.dto";
import type { ParametresOffre } from "../cotation/contenu-offre";
import { RequireModule } from "../auth/access.decorators";
import { Roles } from "../auth/roles.decorator";
import type { RoleId } from "../auth/role.enum";
import { ROLES_COMMERCIAL } from "../auth/access-roles";

// Appels d'offres (commercial/production) + cotation (directeur technique).
const ROLES_APPEL_OFFRES: RoleId[] = [...ROLES_COMMERCIAL, "directeur_technique"];

type ReqUser = { user: { userId: string } };

@Controller("appel-offres")
@UseGuards(JwtAuthGuard)
@RequireModule("appelOffres", "cotation")
export class AppelOffresController {
  constructor(private readonly service: AppelOffresService, private readonly analyse: AnalysePropositionService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Roles(...ROLES_APPEL_OFFRES)
  @Post()
  create(@Body() dto: CreateAppelOffresDto) {
    return this.service.create(dto);
  }

  @Roles(...ROLES_APPEL_OFFRES)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAppelOffresDto) {
    return this.service.update(id, dto);
  }

  @Roles(...ROLES_APPEL_OFFRES)
  @Post(":id/propositions")
  ajouterProposition(@Param("id") id: string, @Body() dto: CreatePropositionDto) {
    return this.service.ajouterProposition(id, dto);
  }

  @Roles(...ROLES_APPEL_OFFRES)
  @Patch(":id/propositions/:propId")
  modifierProposition(@Param("id") id: string, @Param("propId") propId: string, @Body() dto: UpdatePropositionDto) {
    return this.service.modifierProposition(id, propId, dto);
  }

  @Roles(...ROLES_APPEL_OFFRES)
  @Delete(":id/propositions/:propId")
  supprimerProposition(@Param("id") id: string, @Param("propId") propId: string) {
    return this.service.supprimerProposition(id, propId);
  }

  @Roles(...ROLES_APPEL_OFFRES)
  @Post(":id/documents")
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }))
  uploaderDocument(@Param("id") id: string, @UploadedFile() file: Express.Multer.File, @Body() dto: UploadAppelOffresDocumentDto) {
    return this.service.uploaderDocument(id, file, dto);
  }

  @Roles(...ROLES_APPEL_OFFRES)
  @Delete(":id/documents/:docId")
  supprimerDocument(@Param("id") id: string, @Param("docId") docId: string) {
    return this.service.supprimerDocument(id, docId);
  }

  // Chat ARIANA (2026-11) — voir demande utilisateur : "la possibilité de discuter
  // directement avec Ariana". Réutilise le même service que l'analyse de proposition,
  // système différent de IaAssistantService (spécialisé appels d'offres/cotations).
  @RequireModule("ia", "appelOffres")
  @Post("chat")
  chatAriana(@Body() body: ChatArianaDto) {
    return this.service.chatAriana(body.message, body.historique ?? []);
  }

  // ARIANA lit une proposition de compagnie importée et en crée les cotations.
  @Roles(...ROLES_APPEL_OFFRES)
  @Post(":id/documents/:docId/analyser")
  analyserDocument(@Param("id") id: string, @Param("docId") docId: string, @Body() dto: AnalyserDocumentDto, @Req() req: ReqUser) {
    return this.analyse.analyser(id, docId, req.user.userId, dto);
  }

  @Get(":id/offre-parametres")
  parametresOffre(@Param("id") id: string, @Req() req: ReqUser) {
    return this.service.parametresOffre(id, req.user.userId);
  }

  @Roles(...ROLES_APPEL_OFFRES)
  @Put(":id/offre-parametres")
  enregistrerParametresOffre(@Param("id") id: string, @Body() dto: ParametresOffreDto) {
    return this.service.enregistrerParametresOffre(id, dto as unknown as ParametresOffre);
  }
}
