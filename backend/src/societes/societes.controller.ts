import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { SocietesService } from "./societes.service";
import { CreateSocieteDto } from "./dto/create-societe.dto";
import { UpdateSocieteDto } from "./dto/update-societe.dto";
import { SuspendreSocieteDto } from "./dto/suspendre-societe.dto";
import { ParametresEntrepriseService } from "../parametres-entreprise/parametres-entreprise.service";

// Super Admin (2026-09) — voir demande utilisateur : "c'est lui qui crée
// les sociétés d'assurances qui vont utiliser l'application comme outil
// métier". Réservé au rôle super_admin exclusivement — jamais accessible,
// même en lecture, à un administrateur "interne" d'une société (voir
// SocieteAssurance, schema.prisma, pour le détail du chantier multi-tenant
// dont ceci est la Phase 1).
@Controller("societes")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class SocietesController {
  constructor(
    private readonly service: SocietesService,
    private readonly parametresEntreprise: ParametresEntrepriseService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSocieteDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSocieteDto) {
    return this.service.update(id, dto);
  }

  @Patch(":id/suspendre")
  suspendre(@Param("id") id: string, @Body() dto: SuspendreSocieteDto) {
    return this.service.suspendre(id, dto);
  }

  @Patch(":id/reactiver")
  reactiver(@Param("id") id: string) {
    return this.service.reactiver(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Post(":id/assistance")
  assistance(@Param("id") id: string, @Req() req: { user: { userId: string; email: string } }) {
    return this.service.assistance(id, req.user.userId, req.user.email);
  }

  // Logo — sur UNE société ciblée (2026-09) — voir demande utilisateur :
  // "dans l'onglet ou le formulaire de création... on doit pouvoir mettre
  // le logo de l'entreprise." Le Super Admin n'appartient à aucune
  // société (TenantContext null) : ces routes appellent
  // ParametresEntrepriseService avec l'id explicite de la société ciblée,
  // jamais via this.id()/TenantContext (réservé à l'écran interne, voir
  // ParametresEntrepriseController).
  @Post(":id/parametres-entreprise/logo")
  @UseInterceptors(FileInterceptor("logo", { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadLogo(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.parametresEntreprise.uploadLogo(id, file);
  }

  @Delete(":id/parametres-entreprise/logo")
  deleteLogo(@Param("id") id: string) {
    return this.parametresEntreprise.deleteLogo(id);
  }
}
