import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ReglesConsignesService } from "./regles-consignes.service";
import { CreateRegleConsigneDto } from "./dto/create-regle-consigne.dto";
import { UpdateRegleConsigneDto } from "./dto/update-regle-consigne.dto";

const ROLES_GESTION = ["administrateur", "direction_generale"] as const;

// Règles & Consignes (2026-08) — lecture ouverte à tout utilisateur
// authentifié (interne ET portail client, voir demande utilisateur : "le
// client n'aura cela qu'en lecture seul"), écriture réservée aux rôles
// gestionnaires de la zone "Système" (voir AdminShell.tsx).
@Controller("regles-consignes")
@UseGuards(JwtAuthGuard)
export class ReglesConsignesController {
  constructor(private readonly service: ReglesConsignesService) {}

  @Get()
  findAll(@Query("actifSeulement") actifSeulement?: string) {
    return this.service.findAll(actifSeulement === "true");
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...ROLES_GESTION)
  create(@Body() dto: CreateRegleConsigneDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(...ROLES_GESTION)
  update(@Param("id") id: string, @Body() dto: UpdateRegleConsigneDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(...ROLES_GESTION)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Post(":id/document")
  @UseGuards(RolesGuard)
  @Roles(...ROLES_GESTION)
  @UseInterceptors(FileInterceptor("fichier", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadDocument(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadDocument(id, file);
  }

  @Delete(":id/document")
  @UseGuards(RolesGuard)
  @Roles(...ROLES_GESTION)
  deleteDocument(@Param("id") id: string) {
    return this.service.deleteDocument(id);
  }
}
