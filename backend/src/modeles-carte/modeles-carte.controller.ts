import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ModelesCarteService } from "./modeles-carte.service";
import { CreateModeleCarteDto, UpdateModeleCarteDto } from "./dto/modele-carte.dto";

// Catalogue des modèles de carte (2026-09) — voir ModelesCarteService.
// Lecture ouverte à tout compte authentifié (une société doit pouvoir
// lister le catalogue pour choisir/changer son modèle) ; création/
// modification/suppression/upload d'images réservées au Super Admin.
@Controller("modeles-carte")
@UseGuards(JwtAuthGuard)
export class ModelesCarteController {
  constructor(private readonly service: ModelesCarteService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("super_admin")
  create(@Body() dto: CreateModeleCarteDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("super_admin")
  update(@Param("id") id: string, @Body() dto: UpdateModeleCarteDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("super_admin")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Post(":id/recto")
  @UseGuards(RolesGuard)
  @Roles("super_admin")
  @UseInterceptors(FileInterceptor("image", { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadRecto(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadImage(id, "recto", file);
  }

  @Delete(":id/recto")
  @UseGuards(RolesGuard)
  @Roles("super_admin")
  deleteRecto(@Param("id") id: string) {
    return this.service.deleteImage(id, "recto");
  }

  @Post(":id/verso")
  @UseGuards(RolesGuard)
  @Roles("super_admin")
  @UseInterceptors(FileInterceptor("image", { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadVerso(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadImage(id, "verso", file);
  }

  @Delete(":id/verso")
  @UseGuards(RolesGuard)
  @Roles("super_admin")
  deleteVerso(@Param("id") id: string) {
    return this.service.deleteImage(id, "verso");
  }
}
