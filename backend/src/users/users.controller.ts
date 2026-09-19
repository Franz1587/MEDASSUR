import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import * as QRCode from "qrcode";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateModulesDto } from "./dto/update-modules.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

// Gestion des comptes utilisateurs + droits par fonctionnalité (2026-08,
// voir demande utilisateur : "c'est l'administrateur qui donne les droits
// aux fonctionnalités"). Réservé aux rôles d'administration — voir
// RolesGuard, premier module de l'appli à s'en servir.
// super_admin (2026-09) — voir demande utilisateur : "une gestion des
// utilisateur" côté Super Admin. Le middleware Prisma (TenantContext, voir
// prisma.service.ts) ne filtre JAMAIS pour ce rôle (societeId absent de son
// propre compte) : findAll()/update()/remove() portent donc naturellement
// sur TOUS les comptes de TOUTES les sociétés pour lui, sans changement de
// code ici — comportement inchangé pour administrateur/direction_generale
// (restent cloisonnés à leur société via le même middleware).
@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("administrateur", "direction_generale", "super_admin")
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(id, dto);
  }

  @Patch(":id/modules")
  updateModules(@Param("id") id: string, @Body() dto: UpdateModulesDto) {
    return this.service.updateModules(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Post(":id/photo")
  @UseInterceptors(FileInterceptor("photo", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadPhoto(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadPhoto(id, file);
  }

  @Delete(":id/photo")
  deletePhoto(@Param("id") id: string) {
    return this.service.deletePhoto(id);
  }

  // Signature électronique — gestion PAR UN ADMINISTRATEUR pour le compte
  // D'AUTRUI (2026-09) — voir demande utilisateur : "les options qui
  // permettent d'ajouter la signature pour chaque type d'utilisateur"
  // depuis l'écran Utilisateurs (Super Admin ou administrateur de société).
  // Même service que le libre-service (UsersMoiController) — seule
  // différence : l'id vient du paramètre de route (droit réservé aux rôles
  // de ce contrôleur), jamais du token de la personne signée.
  @Post(":id/signature")
  @UseInterceptors(FileInterceptor("signature", { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadSignature(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadSignature(id, file);
  }

  @Delete(":id/signature")
  deleteSignature(@Param("id") id: string) {
    return this.service.deleteSignature(id);
  }

  // QR "signer depuis son téléphone" généré par l'administrateur pour LA
  // PERSONNE (jamais l'admin lui-même) — même principe que
  // UsersMoiController.genererQrSignature, le jeton pointe vers `id`, pas
  // vers le compte connecté. Le statut se vérifie via la même route que le
  // libre-service (GET /users/moi/signature/qr/:token/statut) — elle ne
  // contrôle que le jeton, pas son propriétaire.
  @Post(":id/signature/qr")
  async genererQrSignature(@Param("id") id: string) {
    const { token, expiresAt } = await this.service.genererJetonSignature(id);
    const url = `${process.env.APP_URL ?? "https://medassur.cloud"}/signer/${token}`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
    return { token, url, qrDataUrl, expiresAt };
  }
}
